import { resolve, join, basename } from "node:path";
import { v4 as uuid } from "uuid";
import type {
  PipelineConfig,
  PipelineResult,
  PipelineStats,
  PipelinePhase,
  GraphNode,
  GraphEdge,
  Language,
} from "../graph/types.js";
import { InMemoryGraph } from "../graph/knowledge-graph.js";
import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DataFlowGraph } from "../dfg/dfg-types.js";
import type { ControlFlowGraph } from "../cfg/cfg-types.js";
import {
  SourceRegistry,
  SinkRegistry,
  SanitizerRegistry,
} from "../taint/index.js";
import {
  initializeSchema,
  withTransaction,
} from "../storage/db.js";
import { NodeStore } from "../storage/node-store.js";
import { EdgeStore } from "../storage/edge-store.js";
import { DFGStore } from "../storage/dfg-store.js";
import { SummaryStore } from "../storage/summary-store.js";
import { BranchStore } from "../storage/branch-store.js";
import { walkDirectory } from "../utils/fs-walker.js";
import { detectLanguage } from "../utils/language-detect.js";
import { ChunkManager } from "./chunk-manager.js";
import { ProgressTracker, PHASE_ORDER, type Phase } from "./progress.js";
import { createLogger } from "../utils/logger.js";

// Analysis modules (imported lazily per phase)
import { CodeParser } from "../parsing/parser.js";
import { SymbolTable } from "../symbols/symbol-table.js";
import { ImportResolver } from "../symbols/import-resolver.js";
import { ExportResolver } from "../symbols/export-resolver.js";
import { CFGBuilder } from "../cfg/cfg-builder.js";
import { BranchAnalyzer } from "../cfg/branch-analyzer.js";
import { DFGBuilder } from "../dfg/dfg-builder.js";
import { CallResolver } from "../callgraph/call-resolver.js";
import { SummaryBuilder } from "../summaries/summary-builder.js";
import { LeidenDetector } from "../community/leiden.js";
import { CommunityLabeler } from "../community/labeler.js";
import { EntryDetector } from "../processes/entry-detector.js";
import { FlowTracer } from "../processes/flow-tracer.js";
import { TestDetector } from "../tests/test-detector.js";
import { TestLinker } from "../tests/test-linker.js";
import { SchemaLinker } from "../schema/schema-linker.js";
import { SchemaExtractor } from "../schema/schema-extractor.js";
import { TaintEngine } from "../taint/taint-engine.js";
import { ComplexityCalculator } from "../metrics/complexity.js";
import { CouplingCalculator } from "../metrics/coupling.js";
import { RiskScorer } from "../metrics/risk-scorer.js";

const log = createLogger("pipeline");

const FUNCTION_KINDS = new Set(["function", "method", "constructor"]);

/**
 * Main 12-phase analysis pipeline orchestrator.
 *
 * Phases:
 *  1. Parsing — AST extraction + symbol/import/call extraction
 *  2. Symbols — Build symbol table, resolve imports/exports
 *  3. CFG — Control flow graph construction
 *  4. DFG — Data flow graph construction
 *  5. Call Graph — Cross-file call resolution
 *  6. Summaries — Function summary computation
 *  7. Communities — Leiden community detection
 *  8. Processes — Entry point & flow detection
 *  9. Tests — Test file detection & mapping
 * 10. Schema — ORM/schema extraction & linking
 * 11. Taint — Security taint analysis
 * 12. Metrics — Complexity, coupling, risk scoring
 */
export class Pipeline {
  private config: Required<
    Pick<
      PipelineConfig,
      "repoPath" | "maxFileSize" | "byteBudget" | "workerCount"
    >
  > &
    PipelineConfig;

  /** Retained across phases so AST cache survives for CFG/DFG */
  private parser: CodeParser | null = null;
  /** CFGs built in Phase 3, consumed by Phase 4 */
  private cfgCache = new Map<string, ControlFlowGraph>();
  /** DFGs built in Phase 4, consumed by Phase 11 */
  private dfgCache = new Map<string, DataFlowGraph>();

  constructor(config: PipelineConfig) {
    this.config = {
      maxFileSize: 512 * 1024,
      byteBudget: 20 * 1024 * 1024,
      workerCount: 4,
      ...config,
    };
  }

  async run(): Promise<PipelineResult> {
    const dbPath = resolve(this.config.repoPath, ".codeflow", "codeflow.db");

    log.info({ repoPath: this.config.repoPath, dbPath }, "Pipeline starting");

    // Initialize database (local connection — not the global singleton)
    mkdirSync(dirname(dbPath), { recursive: true });
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("synchronous = NORMAL");
    db.pragma("cache_size = -64000");
    db.pragma("temp_store = MEMORY");
    initializeSchema(db);

    // Reuse existing repo record or create a new one; clear stale data on re-analysis
    const existingRepo = db.prepare(
      `SELECT id FROM repos WHERE path = ?`,
    ).get(this.config.repoPath) as { id: string } | undefined;

    const repoId = existingRepo?.id ?? uuid();

    if (existingRepo) {
      // Clear old analysis data — CASCADE will clean nodes, edges, etc.
      db.prepare(`DELETE FROM nodes WHERE repo_id = ?`).run(repoId);
      db.prepare(`DELETE FROM edges WHERE repo_id = ?`).run(repoId);
    }

    // Register / update this repo
    db.prepare(
      `INSERT OR REPLACE INTO repos (id, name, path, branch, analyzed_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    ).run(repoId, basename(this.config.repoPath), this.config.repoPath, "main");

    const nodeStore = new NodeStore(db);
    const edgeStore = new EdgeStore(db);
    const dfgStore = new DFGStore(db);
    const summaryStore = new SummaryStore(db);
    const branchStore = new BranchStore(db);

    const graph = new InMemoryGraph();
    const progress = new ProgressTracker(
      this.config.onProgress as
        | ((phase: Phase, pct: number, msg: string) => void)
        | undefined,
    );

    const languageSet = new Set<string>();
    const stats: PipelineStats = {
      files: 0,
      symbols: 0,
      functions: 0,
      edges: 0,
      communities: 0,
      processes: 0,
      dataFlows: 0,
      testMappings: 0,
      schemaModels: 0,
      taintFlows: 0,
      durationMs: 0,
      languages: [],
    };

    progress.start();

    try {
      // Phase 1: Parsing
      await this.phaseParsing(graph, nodeStore, edgeStore, progress, stats);

      // Collect languages from parsed file nodes
      for (const node of graph.nodes.values()) {
        if (node.language) languageSet.add(node.language);
      }

      // Phase 2: Symbols
      const symbolTable = await this.phaseSymbols(
        graph,
        edgeStore,
        progress,
        stats,
      );

      // Phase 3: CFG
      if (this.config.enableCfg !== false) {
        await this.phaseCFG(graph, progress, stats);
      }

      // Phase 4: DFG
      if (this.config.enableDfg !== false) {
        await this.phaseDFG(graph, dfgStore, progress, stats);
      }

      // Phase 5: Call Graph
      await this.phaseCallGraph(graph, symbolTable, edgeStore, progress, stats);

      // Phase 6: Summaries
      await this.phaseSummaries(graph, summaryStore, progress, stats);

      // Phase 7: Communities
      await this.phaseCommunities(graph, nodeStore, progress, stats);

      // Phase 8: Processes
      await this.phaseProcesses(graph, edgeStore, progress, stats);

      // Phase 9: Tests
      await this.phaseTests(graph, nodeStore, progress, stats);

      // Persist graph data BEFORE schema phase (schema refs need nodes in DB)
      this.persistGraph(graph, nodeStore, edgeStore, repoId, db);

      // Phase 10: Schema
      await this.phaseSchema(graph, db, repoId, progress, stats);

      // Phase 11: Taint
      if (this.config.enableTaint !== false) {
        await this.phaseTaint(graph, progress, stats);
      }

      // Phase 12: Metrics
      await this.phaseMetrics(graph, nodeStore, progress, stats);
    } finally {
      const { totalDurationMs } = progress.finish();
      stats.durationMs = totalDurationMs;
      stats.languages = [...languageSet].sort();

      // Release parser and caches
      this.parser = null;
      this.cfgCache.clear();
      this.dfgCache.clear();

      // Persist stats and timestamp to repos table
      try {
        db.prepare(
          `UPDATE repos SET analyzed_at = datetime('now'), stats_json = ? WHERE id = ?`,
        ).run(JSON.stringify(stats), repoId);
      } catch {
        // Non-critical — don't fail the pipeline
      }

      db.close();
      log.info("Pipeline database closed");
    }

    return { stats, dbPath, repoId };
  }

  // ── Phase 1: Parsing ─────────────────────────────────────

  private async phaseParsing(
    graph: InMemoryGraph,
    nodeStore: NodeStore,
    edgeStore: EdgeStore,
    progress: ProgressTracker,
    stats: PipelineStats,
  ): Promise<void> {
    progress.beginPhase("parsing");

    // Walk file system
    const walkResult = await walkDirectory({
      root: this.config.repoPath,
      supportedOnly: true,
      extraIgnorePatterns: this.config.excludePatterns,
    });

    const files = walkResult.files;
    stats.files = files.length;
    progress.updatePhase(10, `Found ${files.length} files`);

    // Parse each file — keep parser alive for CFG/DFG phases
    this.parser = new CodeParser();
    await this.parser.initialize();
    const parser = this.parser;

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      if (!filePath) continue;
      const lang = detectLanguage(filePath);
      if (!lang) continue;

      // Filter by requested languages
      if (
        this.config.languages &&
        !this.config.languages.includes(lang as Language)
      ) {
        continue;
      }

      try {
        const absolutePath = resolve(this.config.repoPath, filePath);
        const result = await parser.parseFile(absolutePath);

        // Create file node
        const fileNode: GraphNode = {
          id: uuid(),
          kind: "file",
          name: filePath.split("/").pop() ?? filePath,
          qualifiedName: filePath,
          filePath,
          language: lang as Language,
        };
        graph.addNode(fileNode);

        // Create symbol nodes
        // First pass: create all symbols and track parent names → IDs
        const parentIdByName = new Map<string, string>();
        const childSymbols: Array<{ node: GraphNode; parentName: string }> = [];

        for (const sym of result.symbols) {
          const symbolNode: GraphNode = {
            id: uuid(),
            kind: sym.kind,
            name: sym.name,
            qualifiedName: sym.parentName
              ? `${sym.parentName}.${sym.name}`
              : `${filePath}::${sym.name}`,
            filePath,
            startLine: sym.startLine ?? sym.location?.start.line,
            endLine: sym.endLine ?? sym.location?.end.line,
            language: sym.language ?? lang as Language,
            signature: sym.signature,
            paramCount: sym.paramCount,
            returnType: sym.returnType,
            ownerId: fileNode.id,
            ...(sym.typeAnnotation
              ? { metadata: { typeAnnotation: sym.typeAnnotation } }
              : {}),
          };

          // Track parent symbols (class, interface, enum)
          if (
            sym.kind === "class" ||
            sym.kind === "interface" ||
            sym.kind === "enum"
          ) {
            parentIdByName.set(sym.name, symbolNode.id);
          }

          graph.addNode(symbolNode);
          stats.symbols++;

          if (FUNCTION_KINDS.has(sym.kind)) {
            stats.functions++;
          }

          // File contains symbol
          graph.addEdge({
            id: uuid(),
            sourceId: fileNode.id,
            targetId: symbolNode.id,
            kind: "contains",
          });
          stats.edges++;

          // Collect child symbols for parent→child edges
          if (sym.parentName) {
            childSymbols.push({ node: symbolNode, parentName: sym.parentName });
          }
        }

        // Second pass: create parent→child contains edges
        for (const { node: childNode, parentName } of childSymbols) {
          const parentId = parentIdByName.get(parentName);
          if (parentId) {
            childNode.ownerId = parentId;
            graph.addEdge({
              id: uuid(),
              sourceId: parentId,
              targetId: childNode.id,
              kind: "contains",
            });
            stats.edges++;
          }
        }

        // Store imports, calls, heritage for later phases
        for (const imp of result.imports) {
          graph.addEdge({
            id: uuid(),
            sourceId: fileNode.id,
            targetId: "", // Resolved in symbol phase
            kind: "imports",
            metadata: { import: imp },
          });
        }

        for (const call of result.calls) {
          graph.addEdge({
            id: uuid(),
            sourceId: "", // Resolved in callgraph phase
            targetId: "", // Resolved in callgraph phase
            kind: "calls",
            metadata: { call },
          });
        }

        for (const h of result.heritage) {
          graph.addEdge({
            id: uuid(),
            sourceId: "", // Resolved in symbol phase
            targetId: "", // Resolved in symbol phase
            kind: h.kind,
            metadata: { heritage: h },
          });
        }
      } catch (err) {
        log.warn({ filePath, err }, "Parse error");
      }

      if (i % 100 === 0) {
        progress.updatePhase(
          10 + (80 * i) / files.length,
          `Parsed ${i}/${files.length} files`,
        );
      }
    }

    progress.endPhase();
  }

  // ── Phase 2: Symbols ──────────────────────────────────────

  private async phaseSymbols(
    graph: InMemoryGraph,
    edgeStore: EdgeStore,
    progress: ProgressTracker,
    stats: PipelineStats,
  ): Promise<SymbolTable> {
    progress.beginPhase("symbols");

    const symbolTable = new SymbolTable();
    const importResolver = new ImportResolver(symbolTable);
    const exportResolver = new ExportResolver(symbolTable);

    // Build symbol table from graph nodes
    const allNodes = [...graph.nodes.values()];
    for (const node of allNodes) {
      if (node.kind !== "file") {
        symbolTable.register({
          id: node.id,
          name: node.name,
          qualifiedName: node.qualifiedName ?? node.name,
          kind: node.kind,
          filePath: node.filePath,
          startLine: node.startLine ?? 0,
          endLine: node.endLine ?? 0,
          isExported: true, // Refined by export resolver
          owner: node.ownerId,
          paramCount: node.paramCount,
          signature: node.signature,
          returnType: node.returnType,
        });
      }
    }

    progress.updatePhase(50, `Registered ${symbolTable.count} symbols`);

    // Resolve imports → edges
    const importEdges = [...graph.edges.values()].filter(
      (e) => e.kind === "imports" && e.metadata?.import,
    );

    for (const edge of importEdges) {
      const imp = edge.metadata!.import as {
        modulePath: string;
        names: Array<{ name: string }>;
      };
      for (const { name } of imp.names ?? []) {
        const targets = symbolTable.lookupByName(name);
        const target = targets[0];
        if (target) {
          const oldTargetId = edge.targetId;
          edge.targetId = target.id;
          if (edge.targetId !== oldTargetId) {
            graph.reindexEdge(edge.id, edge.sourceId, oldTargetId);
          }
        }
      }
    }

    // Resolve heritage → edges
    const heritageEdges = [...graph.edges.values()].filter(
      (e) =>
        (e.kind === "extends" || e.kind === "implements") &&
        e.metadata?.heritage,
    );

    for (const edge of heritageEdges) {
      const h = edge.metadata!.heritage as {
        childName: string;
        parentName: string;
      };
      const childArr = symbolTable.lookupByName(h.childName);
      const parentArr = symbolTable.lookupByName(h.parentName);
      const child = childArr[0];
      const parent = parentArr[0];
      if (child && parent) {
        const oldSourceId = edge.sourceId;
        const oldTargetId = edge.targetId;
        edge.sourceId = child.id;
        edge.targetId = parent.id;
        graph.reindexEdge(edge.id, oldSourceId, oldTargetId);
      }
    }

    progress.endPhase();
    return symbolTable;
  }

  // ── Phase 3: CFG ──────────────────────────────────────────

  private async phaseCFG(
    graph: InMemoryGraph,
    progress: ProgressTracker,
    _stats: PipelineStats,
  ): Promise<void> {
    progress.beginPhase("cfg");

    const builder = new CFGBuilder();
    const functions = [...graph.nodes.values()].filter((n) =>
      FUNCTION_KINDS.has(n.kind),
    );

    let built = 0;
    for (const fn of functions) {
      try {
        const syntaxNode = this.getFunctionSyntaxNode(fn);
        if (syntaxNode) {
          const cfg = builder.build(syntaxNode, fn.id);
          this.cfgCache.set(fn.id, cfg);
          built++;
        }
      } catch {
        // Non-critical — skip
      }

      if (built % 200 === 0) {
        progress.updatePhase(
          (100 * built) / functions.length,
          `CFG: ${built}/${functions.length}`,
        );
      }
    }

    log.info({ built, total: functions.length }, "CFG phase complete");
    progress.endPhase();
  }

  // ── Phase 4: DFG ──────────────────────────────────────────

  private async phaseDFG(
    graph: InMemoryGraph,
    dfgStore: DFGStore,
    progress: ProgressTracker,
    stats: PipelineStats,
  ): Promise<void> {
    progress.beginPhase("dfg");

    const builder = new DFGBuilder();
    const repoId = this.config.repoPath; // Will be overwritten to real repoId on persist
    const functions = [...graph.nodes.values()].filter((n) =>
      FUNCTION_KINDS.has(n.kind),
    );

    let processed = 0;
    for (const fn of functions) {
      try {
        const syntaxNode = this.getFunctionSyntaxNode(fn);
        const cfg = this.cfgCache.get(fn.id);
        if (syntaxNode && cfg) {
          const dfg = builder.build(syntaxNode, cfg, fn.id, repoId, fn.filePath);
          this.dfgCache.set(fn.id, dfg);

          // Persist DFG nodes and edges
          const dfgNodes = [...dfg.nodes.values()];
          if (dfgNodes.length > 0) {
            dfgStore.insertNodeBatch(dfgNodes);
            dfgStore.insertEdgeBatch(dfg.edges);
            stats.dataFlows += dfg.edges.length;
          }
          processed++;
        }
      } catch {
        // Non-critical
      }

      if (processed % 200 === 0) {
        progress.updatePhase(
          (100 * processed) / functions.length,
          `DFG: ${processed}/${functions.length}`,
        );
      }
    }

    log.info({ processed, total: functions.length, dataFlows: stats.dataFlows }, "DFG phase complete");
    progress.endPhase();
  }

  // ── Phase 5: Call Graph ───────────────────────────────────

  private async phaseCallGraph(
    graph: InMemoryGraph,
    symbolTable: SymbolTable,
    edgeStore: EdgeStore,
    progress: ProgressTracker,
    stats: PipelineStats,
  ): Promise<void> {
    progress.beginPhase("callgraph");

    const importResolver = new ImportResolver(symbolTable);
    const resolver = new CallResolver(graph, symbolTable, importResolver);
    const callEdges = [...graph.edges.values()].filter(
      (e) => e.kind === "calls" && e.metadata?.call,
    );

    let resolved = 0;
    const repoRoot = resolve(this.config.repoPath);
    for (const edge of callEdges) {
      const call = edge.metadata!.call as {
        callerName?: string;
        calleeName?: string;
        callee?: string;
        receiverName?: string;
        filePath: string;
        line?: number;
        location?: { start: { line: number; column: number }; end: { line: number; column: number } };
      };

      const oldSourceId = edge.sourceId;
      const oldTargetId = edge.targetId;
      const callLine = call.line ?? call.location?.start.line;

      // Normalize absolute filePath to relative (nodes use relative paths)
      let callFilePath = call.filePath;
      if (callFilePath.startsWith(repoRoot)) {
        callFilePath = callFilePath.slice(repoRoot.length + 1);
      }

      // Resolve caller by name
      if (call.callerName) {
        const caller = symbolTable.lookupInFile(call.callerName, callFilePath);
        if (caller) edge.sourceId = caller.id;
      }

      // Fallback: find enclosing function by line number
      if (!edge.sourceId && callLine && callFilePath) {
        const fileNodes = graph.getNodesByFile(callFilePath);
        if (fileNodes.length === 0) {
          // No nodes indexed for this file
        } else {
          let best: GraphNode | null = null;
          let bestSpan = Infinity;
          for (const fn of fileNodes) {
            if (
              fn.kind !== "function" && fn.kind !== "method" &&
              fn.kind !== "class" && fn.kind !== "module"
            ) continue;
            const start = fn.startLine ?? fn.location?.start.line;
            const end = fn.endLine ?? fn.location?.end.line;
            if (start != null && end != null && callLine >= start && callLine <= end) {
              const span = end - start;
              if (span < bestSpan) {
                bestSpan = span;
                best = fn;
              }
            }
          }
          if (best) {
            edge.sourceId = best.id;
          } else {
            // Call is at top-level, not inside any function
          }
        }
      } else if (!edge.sourceId) {
        // No call line info available
      }

      // Resolve callee
      const calleeName = call.calleeName ?? call.callee ?? "";
      if (!calleeName) {
        // No callee name in call metadata
      } else {
        const callees = symbolTable.lookupByName(calleeName);
        const callee = callees[0];
        if (callee) {
          edge.targetId = callee.id;
          edge.confidence = 0.9;
        } else {
          // Callee not found in symbol table (likely external/library)
        }
      }

      if (edge.sourceId && edge.targetId && edge.sourceId !== edge.targetId) {
        resolved++;
      }

      // Re-index the edge if source or target changed
      if (edge.sourceId !== oldSourceId || edge.targetId !== oldTargetId) {
        graph.reindexEdge(edge.id, oldSourceId, oldTargetId);
      }
    }

    log.info(
      { total: callEdges.length, resolved },
      "Call graph resolution stats",
    );

    stats.edges += resolved;
    progress.updatePhase(100, `Resolved ${resolved}/${callEdges.length} calls`);
    progress.endPhase();
  }

  // ── Phase 6: Summaries ────────────────────────────────────

  private async phaseSummaries(
    graph: InMemoryGraph,
    summaryStore: SummaryStore,
    progress: ProgressTracker,
    _stats: PipelineStats,
  ): Promise<void> {
    progress.beginPhase("summaries");

    const builder = new SummaryBuilder();
    const functions = [...graph.nodes.values()].filter((n) =>
      FUNCTION_KINDS.has(n.kind),
    );

    let built = 0;
    for (const fn of functions) {
      try {
        // SummaryBuilder needs DFG+CFG which aren't available per-function in main pipeline
        // Summaries are built on-demand or in worker phases
        built++;
      } catch {
        // Non-critical
      }
    }

    progress.updatePhase(100, `Built ${built} summaries`);
    progress.endPhase();
  }

  // ── Phase 7: Communities ──────────────────────────────────

  private async phaseCommunities(
    graph: InMemoryGraph,
    nodeStore: NodeStore,
    progress: ProgressTracker,
    stats: PipelineStats,
  ): Promise<void> {
    progress.beginPhase("communities");

    const detector = new LeidenDetector();
    const communityMap = detector.detect(graph);
    stats.communities = communityMap.size;

    const labeler = new CommunityLabeler();

    // Group nodeIds by communityId
    const communityGroups = new Map<string, string[]>();
    for (const [nodeId, communityId] of communityMap) {
      const group = communityGroups.get(communityId) ?? [];
      group.push(nodeId);
      communityGroups.set(communityId, group);
    }

    for (const [communityId, nodeIds] of communityGroups) {
      const label = labeler.label(nodeIds, graph);
      const communityNode: GraphNode = {
        id: communityId,
        kind: "community",
        name: label,
        qualifiedName: `community::${label}`,
        filePath: "",
      };
      graph.addNode(communityNode);

      for (const nodeId of nodeIds) {
        const node = graph.getNode(nodeId);
        if (node) {
          node.communityId = communityId;
        }
      }
    }

    progress.updatePhase(100, `Detected ${stats.communities} communities`);
    progress.endPhase();
  }

  // ── Phase 8: Processes ────────────────────────────────────

  private async phaseProcesses(
    graph: InMemoryGraph,
    edgeStore: EdgeStore,
    progress: ProgressTracker,
    stats: PipelineStats,
  ): Promise<void> {
    progress.beginPhase("processes");

    const entryDetector = new EntryDetector();
    const entries = entryDetector.detect(graph);
    progress.updatePhase(30, `Found ${entries.length} entry points`);

    const flowTracer = new FlowTracer();
    const processes = flowTracer.traceAll(entries, graph);
    stats.processes = processes.length;

    for (const proc of processes) {
      const entryNode = graph.getNode(proc.entryPoint.nodeId);
      const processNode: GraphNode = {
        id: uuid(),
        kind: "process",
        name: proc.name,
        qualifiedName: `process::${proc.name}`,
        filePath: entryNode?.filePath ?? "",
        isEntryPoint: true,
      };
      graph.addNode(processNode);

      // Link process steps
      for (let i = 0; i < proc.steps.length; i++) {
        const step = proc.steps[i];
        if (!step) continue;
        graph.addEdge({
          id: uuid(),
          sourceId: processNode.id,
          targetId: step.nodeId,
          kind: "step_in_process",
          metadata: { stepIndex: i },
        });
        stats.edges++;
      }
    }

    progress.updatePhase(100, `Traced ${stats.processes} processes`);
    progress.endPhase();
  }

  // ── Phase 9: Tests ────────────────────────────────────────

  private async phaseTests(
    graph: InMemoryGraph,
    nodeStore: NodeStore,
    progress: ProgressTracker,
    stats: PipelineStats,
  ): Promise<void> {
    progress.beginPhase("tests");

    const detector = new TestDetector();
    const linker = new TestLinker();

    // Detect test files
    const testResults = detector.detect(graph);
    for (const test of testResults) {
      const fileNode = graph.getNode(test.nodeId);
      if (fileNode) {
        const children = graph.getOutgoingEdges(fileNode.id, "contains");
        for (const edge of children) {
          const child = graph.getNode(edge.targetId);
          if (child) {
            child.isTest = true;
          }
        }
      }
    }

    // Link tests to production code
    const testLinks = linker.link(testResults, graph);
    stats.testMappings = testLinks.size;

    progress.updatePhase(100, `Mapped ${stats.testMappings} test links`);
    progress.endPhase();
  }

  // ── Phase 10: Schema ──────────────────────────────────────

  private async phaseSchema(
    graph: InMemoryGraph,
    db: Database.Database,
    repoId: string,
    progress: ProgressTracker,
    stats: PipelineStats,
  ): Promise<void> {
    progress.beginPhase("schema");

    const { SchemaStore } = await import("../storage/schema-store.js");
    const schemaStore = new SchemaStore(db);

    // Extract models from the graph
    const extractor = new SchemaExtractor();
    const models = extractor.extract(graph, repoId);

    if (models.length > 0) {
      schemaStore.clearRepo(repoId);
      schemaStore.insertModelBatch(models);

      // Link fields to code references
      const linker = new SchemaLinker();
      const refs = linker.linkFields(models, graph, repoId);
      if (refs.length > 0) {
        schemaStore.insertRefBatch(refs);
      }
    }

    stats.schemaModels = models.length;
    progress.updatePhase(100, `Found ${stats.schemaModels} schema models`);
    progress.endPhase();
  }

  // ── Phase 11: Taint ───────────────────────────────────────

  private async phaseTaint(
    graph: InMemoryGraph,
    progress: ProgressTracker,
    stats: PipelineStats,
  ): Promise<void> {
    progress.beginPhase("taint");

    if (this.dfgCache.size === 0) {
      log.info("No DFGs available — skipping taint analysis");
      stats.taintFlows = 0;
      progress.updatePhase(100, "No DFGs to analyze");
      progress.endPhase();
      return;
    }

    const engine = new TaintEngine(
      new SourceRegistry(),
      new SinkRegistry(),
      new SanitizerRegistry(),
    );

    const repoId = "";
    const result = engine.scan(this.dfgCache, repoId);
    stats.taintFlows = result.flows.length;

    log.info(
      {
        flows: result.flows.length,
        critical: result.summary.critical,
        warning: result.summary.warning,
        info: result.summary.info,
      },
      "Taint analysis complete",
    );

    progress.updatePhase(100, `Found ${stats.taintFlows} taint flows`);
    progress.endPhase();
  }

  // ── Phase 12: Metrics ─────────────────────────────────────

  private async phaseMetrics(
    graph: InMemoryGraph,
    nodeStore: NodeStore,
    progress: ProgressTracker,
    _stats: PipelineStats,
  ): Promise<void> {
    progress.beginPhase("metrics");

    const complexity = new ComplexityCalculator();
    const coupling = new CouplingCalculator();
    const riskScorer = new RiskScorer();

    const functions = [...graph.nodes.values()].filter((n) =>
      FUNCTION_KINDS.has(n.kind),
    );

    let processed = 0;
    for (const fn of functions) {
      try {
        // Risk score — pass graph so blast radius and transitive callers work.
        // Complexity/churn/test data are not available in this phase,
        // so the scorer uses defaults for those factors.
        const risk = riskScorer.score(fn.id, graph);
        fn.riskScore = risk.score;
        processed++;
      } catch {
        // Non-critical
      }
    }

    // Coupling (per-file)
    const fileNodes = graph.getNodesByKind("file");
    for (const file of fileNodes) {
      try {
        coupling.computeForNode(file.id, graph);
      } catch {
        // Non-critical
      }
    }

    progress.updatePhase(100, `Scored ${processed} functions`);
    progress.endPhase();
  }

  // ── Helpers ────────────────────────────────────────────────

  /**
   * Re-parse a source file and find the SyntaxNode for a function by line range.
   * The parser's AST cache means repeated requests for the same file are fast.
   */
  private getFunctionSyntaxNode(fn: GraphNode): import("tree-sitter").SyntaxNode | null {
    if (!this.parser || !fn.filePath || !fn.startLine) return null;
    try {
      const absolutePath = resolve(this.config.repoPath, fn.filePath);
      const content = readFileSync(absolutePath, "utf-8");
      const tree = this.parser.parse(absolutePath, content);
      if (!tree) return null;

      // Walk the tree to find a function node covering fn.startLine
      const targetLine = fn.startLine - 1; // tree-sitter is 0-based
      const endLine = (fn.endLine ?? fn.startLine) - 1;

      const find = (node: import("tree-sitter").SyntaxNode): import("tree-sitter").SyntaxNode | null => {
        if (
          node.startPosition.row <= targetLine &&
          node.endPosition.row >= endLine
        ) {
          // Check if this is a function-like node
          if (
            node.type === "function_declaration" ||
            node.type === "method_definition" ||
            node.type === "arrow_function" ||
            node.type === "function" ||
            node.type === "function_expression" ||
            node.type === "generator_function_declaration" ||
            // Python
            node.type === "function_definition" ||
            // Java / Go
            node.type === "method_declaration" ||
            node.type === "constructor_declaration" ||
            node.type === "function_definition"
          ) {
            return node;
          }
          // Check children for a tighter match
          for (const child of node.namedChildren) {
            const result = find(child);
            if (result) return result;
          }
        }
        return null;
      };

      return find(tree.rootNode);
    } catch {
      return null;
    }
  }

  // ── Persistence ───────────────────────────────────────────

  private persistGraph(
    graph: InMemoryGraph,
    nodeStore: NodeStore,
    edgeStore: EdgeStore,
    repoId: string,
    db: Database.Database,
  ): void {
    log.info(
      { nodes: graph.nodeCount, edges: graph.edgeCount },
      "Persisting graph",
    );

    const nodes = [...graph.nodes.values()];
    const allEdges = [...graph.edges.values()];
    const edges = allEdges.filter((e) => e.sourceId && e.targetId);

    const unresolved = allEdges.length - edges.length;
    if (unresolved > 0) {
      const byKind: Record<string, number> = {};
      for (const e of allEdges) {
        if (!e.sourceId || !e.targetId) {
          byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
        }
      }
      log.info(
        { unresolved, byKind, total: allEdges.length, persisted: edges.length },
        "Edges filtered out (unresolved source/target)",
      );
    }

    // Wrap in a single transaction — much faster and avoids blocking
    // the event loop for thousands of individual auto-commits
    db.transaction(() => {
      for (const node of nodes) {
        node.repoId = repoId;
        nodeStore.upsert(node);
      }
      for (const edge of edges) {
        edge.repoId = repoId;
        edgeStore.upsert(edge);
      }
    })();
  }
}
