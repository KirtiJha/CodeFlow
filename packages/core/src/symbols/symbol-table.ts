import type { ExtractedSymbol, NodeKind } from "../graph/types.js";
import { qualifiedName } from "../utils/path-utils.js";
import { v4 as uuid } from "uuid";

/**
 * Dual-index symbol table: lookup by name and by qualified name.
 * Stores all symbols discovered during parsing for fast resolution.
 */
export class SymbolTable {
  private readonly byName = new Map<string, SymbolEntry[]>();
  private readonly byQualifiedName = new Map<string, SymbolEntry>();
  private readonly byFile = new Map<string, SymbolEntry[]>();

  add(symbol: ExtractedSymbol): SymbolEntry {
    const qn = symbol.owner
      ? qualifiedName(symbol.filePath, `${symbol.owner}.${symbol.name}`)
      : qualifiedName(symbol.filePath, symbol.name);

    const entry: SymbolEntry = {
      id: uuid(),
      name: symbol.name,
      qualifiedName: qn,
      kind: symbol.kind,
      filePath: symbol.filePath,
      location: symbol.location,
      owner: symbol.owner,
      signature: symbol.signature,
      paramCount: symbol.paramCount,
      returnType: symbol.returnType,
      isExported: symbol.isExported ?? false,
    };

    // Index by name
    const existing = this.byName.get(symbol.name);
    if (existing) {
      existing.push(entry);
    } else {
      this.byName.set(symbol.name, [entry]);
    }

    // Index by qualified name
    this.byQualifiedName.set(qn, entry);

    // Index by file
    const fileEntries = this.byFile.get(symbol.filePath);
    if (fileEntries) {
      fileEntries.push(entry);
    } else {
      this.byFile.set(symbol.filePath, [entry]);
    }

    return entry;
  }

  /**
   * Look up by simple name — may return multiple matches across files.
   */
  lookupByName(name: string): SymbolEntry[] {
    return this.byName.get(name) ?? [];
  }

  /**
   * Look up by qualified name — unique result.
   */
  lookupByQualifiedName(qualifiedName: string): SymbolEntry | null {
    return this.byQualifiedName.get(qualifiedName) ?? null;
  }

  /**
   * Get all symbols in a file.
   */
  getByFile(filePath: string): SymbolEntry[] {
    return this.byFile.get(filePath) ?? [];
  }

  /**
   * Resolve a reference: given a name and the file context, find the best match.
   */
  resolve(
    name: string,
    fromFile: string,
    importMap: Map<string, string>,
  ): SymbolEntry | null {
    // 1. Check import map first
    const importedQN = importMap.get(name);
    if (importedQN) {
      return this.byQualifiedName.get(importedQN) ?? null;
    }

    // 2. Same-file match
    const sameFile = this.byFile.get(fromFile)?.find((e) => e.name === name);
    if (sameFile) return sameFile;

    // 3. Global lookup — prefer exported symbols
    const candidates = this.byName.get(name) ?? [];
    if (candidates.length === 1) return candidates[0] ?? null;
    const exported = candidates.filter((c) => c.isExported);
    if (exported.length === 1) return exported[0] ?? null;

    return candidates[0] ?? null;
  }

  get size(): number {
    return this.byQualifiedName.size;
  }

  /** Alias for `size` — used by pipeline. */
  get count(): number {
    return this.byQualifiedName.size;
  }

  /**
   * Register a symbol — accepts a flexible shape from the pipeline and maps it to add().
   */
  register(data: {
    id?: string;
    name: string;
    qualifiedName?: string;
    kind: NodeKind;
    filePath: string;
    startLine?: number;
    endLine?: number;
    isExported?: boolean;
    owner?: string;
    paramCount?: number;
    signature?: string;
    returnType?: string;
  }): SymbolEntry {
    const fakeSymbol: ExtractedSymbol = {
      name: data.name,
      kind: data.kind,
      filePath: data.filePath,
      startLine: data.startLine,
      endLine: data.endLine,
      owner: data.owner,
      signature: data.signature,
      paramCount: data.paramCount,
      returnType: data.returnType,
      isExported: data.isExported,
      location:
        data.startLine !== undefined
          ? {
              start: { line: data.startLine, column: 0 },
              end: { line: data.endLine ?? data.startLine, column: 0 },
            }
          : undefined,
    };
    const entry = this.add(fakeSymbol);
    if (data.id) entry.id = data.id;
    return entry;
  }

  /**
   * Look up the best match for name in a specific file.
   */
  lookupInFile(name: string, filePath: string): SymbolEntry | null {
    const fileEntries = this.byFile.get(filePath);
    return fileEntries?.find((e) => e.name === name) ?? null;
  }

  entries(): IterableIterator<SymbolEntry> {
    return this.byQualifiedName.values();
  }

  clear(): void {
    this.byName.clear();
    this.byQualifiedName.clear();
    this.byFile.clear();
  }
}

export interface SymbolEntry {
  id: string;
  name: string;
  qualifiedName: string;
  kind: NodeKind;
  filePath: string;
  location?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  owner?: string;
  signature?: string;
  paramCount?: number;
  returnType?: string;
  isExported: boolean;
}
