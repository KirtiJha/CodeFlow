import type {
  GraphEdge,
  ExtractedCall,
  ExtractedImport,
} from "../graph/types.js";
import type { KnowledgeGraph } from "../graph/knowledge-graph.js";
import type { SymbolTable, SymbolEntry } from "../symbols/symbol-table.js";
import type { ImportResolver } from "../symbols/import-resolver.js";
import { v4 as uuid } from "uuid";
import { createLogger } from "../utils/logger.js";

const log = createLogger("callgraph:resolver");

export interface ResolvedCall {
  edge: GraphEdge;
  confidence: number;
  tier: ResolutionTier;
}

export type ResolutionTier =
  | "same_file_exact"
  | "import_scoped"
  | "type_narrowed"
  | "global_fuzzy"
  | "unresolved";

const TIER_CONFIDENCE: Record<ResolutionTier, number> = {
  same_file_exact: 0.95,
  import_scoped: 0.9,
  type_narrowed: 0.85,
  global_fuzzy: 0.5,
  unresolved: 0.0,
};

/**
 * Tiered call resolution:
 *   Tier 1: Same-file exact match (0.95)
 *   Tier 2: Import-scoped match (0.90)
 *   Tier 3: Type-narrowed match (0.85)
 *   Tier 4: Global fuzzy match (0.50)
 */
export class CallResolver {
  constructor(
    private readonly graph: KnowledgeGraph,
    private readonly symbolTable: SymbolTable,
    private readonly importResolver: ImportResolver,
  ) {}

  resolveAll(
    calls: ExtractedCall[],
    imports: ExtractedImport[],
    callerNodeIds: Map<string, string>, // callerName → nodeId
    receiverTypes: Map<string, string>, // receiverName → typeName
  ): ResolvedCall[] {
    const results: ResolvedCall[] = [];

    // Pre-build import maps per file
    const importMaps = new Map<string, Map<string, string>>();
    for (const call of calls) {
      if (!importMaps.has(call.filePath)) {
        const fileImports = imports.filter((i) => i.filePath === call.filePath);
        importMaps.set(
          call.filePath,
          this.importResolver.buildImportMap(fileImports, call.filePath),
        );
      }
    }

    for (const call of calls) {
      const importMap = importMaps.get(call.filePath)!;
      const resolved = this.resolveCall(
        call,
        importMap,
        callerNodeIds,
        receiverTypes,
      );
      if (resolved) {
        results.push(resolved);
      }
    }

    log.debug({ count: results.length }, "Resolved calls");
    return results;
  }

  resolveCall(
    call: ExtractedCall,
    importMap: Map<string, string>,
    callerNodeIds: Map<string, string>,
    receiverTypes: Map<string, string>,
  ): ResolvedCall | null {
    const sourceId = call.callerName
      ? callerNodeIds.get(call.callerName)
      : undefined;

    if (!sourceId) return null;

    // Tier 1: Same-file exact match
    const tier1 = this.resolveSameFile(call);
    if (tier1)
      return this.buildResolvedCall(sourceId, tier1, "same_file_exact");

    // Tier 2: Import-scoped resolution
    const tier2 = this.resolveImportScoped(call, importMap);
    if (tier2) return this.buildResolvedCall(sourceId, tier2, "import_scoped");

    // Tier 3: Type-narrowed (method calls with receiver type info)
    if (call.isMethodCall && call.receiverName) {
      const receiverType = receiverTypes.get(call.receiverName);
      if (receiverType) {
        const tier3 = this.resolveTypeNarrowed(call, receiverType);
        if (tier3)
          return this.buildResolvedCall(sourceId, tier3, "type_narrowed");
      }
    }

    // Tier 4: Global fuzzy match
    const tier4 = this.resolveGlobalFuzzy(call);
    if (tier4) return this.buildResolvedCall(sourceId, tier4, "global_fuzzy");

    return null;
  }

  /**
   * Tier 1: Look for the callee in the same file.
   */
  private resolveSameFile(call: ExtractedCall): SymbolEntry | null {
    const name = call.isMethodCall ? call.calleeName : call.calleeName;
    const fileSymbols = this.symbolTable.getByFile(call.filePath);

    // Exact name match in same file
    for (const symbol of fileSymbols) {
      if (symbol.name === name && this.isCallable(symbol)) {
        return symbol;
      }
    }
    return null;
  }

  /**
   * Tier 2: Resolve via imports.
   */
  private resolveImportScoped(
    call: ExtractedCall,
    importMap: Map<string, string>,
  ): SymbolEntry | null {
    const calleeName = call.calleeName ?? "";

    // Check if the callee is an imported name
    const qualifiedName = importMap.get(calleeName);
    if (qualifiedName) {
      return this.symbolTable.lookupByQualifiedName(qualifiedName);
    }

    // For method calls, check if receiver is imported
    if (call.isMethodCall && call.receiverName) {
      const receiverQN = importMap.get(call.receiverName);
      if (receiverQN) {
        // Look for the method on that type
        const receiverEntry =
          this.symbolTable.lookupByQualifiedName(receiverQN);
        if (receiverEntry) {
          return this.findMethodOnType(receiverEntry, calleeName);
        }
      }
    }

    return null;
  }

  /**
   * Tier 3: Use receiver type information from DFG to narrow method resolution.
   */
  private resolveTypeNarrowed(
    call: ExtractedCall,
    receiverType: string,
  ): SymbolEntry | null {
    // Look for classes/interfaces with this type name
    const candidates = this.symbolTable.lookupByName(receiverType);
    for (const candidate of candidates) {
      if (
        candidate.kind === "class" ||
        candidate.kind === "interface" ||
        candidate.kind === "struct"
      ) {
        const method = this.findMethodOnType(candidate, call.calleeName ?? "");
        if (method) return method;
      }
    }
    return null;
  }

  /**
   * Tier 4: Global name-based fuzzy match — lowest confidence.
   */
  private resolveGlobalFuzzy(call: ExtractedCall): SymbolEntry | null {
    const candidates = this.symbolTable.lookupByName(call.calleeName ?? "");
    if (candidates.length === 0) return null;

    // Prefer exported callables
    const exported = candidates.filter(
      (c) => c.isExported && this.isCallable(c),
    );
    if (exported.length === 1) return exported[0] ?? null;

    // If multiple, prefer by param count
    if (call.argCount !== undefined) {
      const paramMatch = (exported.length > 0 ? exported : candidates).find(
        (c) => c.paramCount === call.argCount,
      );
      if (paramMatch) return paramMatch ?? null;
    }

    // Return first exported, or first callable
    return exported[0] ?? candidates.find((c) => this.isCallable(c)) ?? null;
  }

  /**
   * Find a method on a type by looking at the symbol table.
   */
  private findMethodOnType(
    typeEntry: SymbolEntry,
    methodName: string,
  ): SymbolEntry | null {
    const fileSymbols = this.symbolTable.getByFile(typeEntry.filePath);
    return (
      fileSymbols.find(
        (s) =>
          s.name === methodName &&
          s.owner === typeEntry.name &&
          (s.kind === "method" || s.kind === "function"),
      ) ?? null
    );
  }

  private isCallable(entry: SymbolEntry): boolean {
    return (
      entry.kind === "function" ||
      entry.kind === "method" ||
      entry.kind === "constructor" ||
      entry.kind === "class"
    );
  }

  private buildResolvedCall(
    sourceId: string,
    target: SymbolEntry,
    tier: ResolutionTier,
  ): ResolvedCall {
    const targetNode = this.findGraphNode(target);
    const confidence = TIER_CONFIDENCE[tier];

    const edge: GraphEdge = {
      id: uuid(),
      sourceId,
      targetId: targetNode ?? target.qualifiedName,
      kind: "calls",
      confidence,
      metadata: { tier },
    };

    return { edge, confidence, tier };
  }

  private findGraphNode(entry: SymbolEntry): string | undefined {
    for (const [id, node] of this.graph.nodes) {
      if (node.qualifiedName === entry.qualifiedName) return id;
    }
    return undefined;
  }
}
