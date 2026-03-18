import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolve } from "node:path";
import { openDatabase, initializeSchema } from "@codeflow/core/storage";
import { InMemoryGraph } from "@codeflow/core/graph/knowledge-graph";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import { SummaryStore } from "@codeflow/core/storage/summary-store";
import { HybridSearch } from "@codeflow/core/search";
import {
  TaintEngine,
  SourceRegistry,
  SinkRegistry,
  SanitizerRegistry,
} from "@codeflow/core/taint";
import { RiskScorer } from "@codeflow/core/metrics";
import { SchemaLinker } from "@codeflow/core/schema";
import { TestLinker } from "@codeflow/core/tests";
import { Pipeline } from "@codeflow/core/pipeline";
import { GitClient } from "@codeflow/core/git";
import { BranchScanner, ConflictDetector } from "@codeflow/core/branches";
import type { GraphNode, GraphEdge } from "@codeflow/core/graph/types";
import type { TaintFlow, SecurityScanResult } from "@codeflow/core/taint";

export interface McpServerConfig {
  repoPath: string;
}

function loadGraph(repoPath: string) {
  const dbPath = resolve(repoPath, ".codeflow", "codeflow.db");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);
  const graph = new InMemoryGraph();
  for (const n of nodeStore.getAll()) graph.addNode(n);
  for (const e of edgeStore.getAll()) graph.addEdge(e);
  return { db, graph, nodeStore, edgeStore };
}

export async function startMcpServer(config: McpServerConfig): Promise<void> {
  const server = new McpServer({
    name: "codeflow",
    version: "0.1.0",
  });

  // ── Tool: codeflow_query ──────────────────────────────────
  server.tool(
    "codeflow_query",
    "Search the code knowledge graph",
    { query: z.string(), limit: z.number().optional() },
    async ({ query, limit }) => {
      const { db } = loadGraph(config.repoPath);
      const search = new HybridSearch(db);
      await search.initialize();
      const results = search.search(query, limit ?? 20);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(results, null, 2) },
        ],
      };
    },
  );

  // ── Tool: codeflow_trace ──────────────────────────────────
  server.tool(
    "codeflow_trace",
    "Trace data flow from a symbol",
    {
      file: z.string(),
      from: z.string().optional(),
      to: z.string().optional(),
      line: z.number().optional(),
    },
    async ({ file, from, to, line }) => {
      const { graph, nodeStore, edgeStore } = loadGraph(config.repoPath);
      const sourceNodes = from
        ? nodeStore.findByName(from)
        : line
          ? nodeStore.findByFileAndLine(file, line)
          : nodeStore.findByFile(file);

      const traces: string[][] = [];
      const visited = new Set<string>();
      const queue: Array<{ nodeId: string; path: string[]; depth: number }> =
        [];

      for (const node of sourceNodes.slice(0, 1)) {
        queue.push({
          nodeId: node.id,
          path: [node.qualifiedName ?? node.name],
          depth: 0,
        });
      }

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.nodeId) || current.depth > 5) continue;
        visited.add(current.nodeId);

        const outgoing = edgeStore.getOutgoing(current.nodeId, "data_flow");
        if (outgoing.length === 0) traces.push(current.path);
        for (const edge of outgoing) {
          const target = nodeStore.getById(edge.targetId);
          if (target) {
            queue.push({
              nodeId: target.id,
              path: [...current.path, target.qualifiedName ?? target.name],
              depth: current.depth + 1,
            });
          }
        }
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(traces, null, 2) },
        ],
      };
    },
  );

  // ── Tool: codeflow_branches ───────────────────────────────
  server.tool(
    "codeflow_branches",
    "Analyze branch conflicts",
    { minSeverity: z.enum(["low", "medium", "high", "critical"]).optional() },
    async ({ minSeverity }) => {
      const gitClient = new GitClient(config.repoPath);
      const scanner = new BranchScanner(gitClient.raw(), "default");
      const branches = await scanner.scan();

      // ConflictDetector requires fingerprints; return basic branch info
      const result = branches.map((b) => ({
        branch: b.branchName,
        author: b.author,
        lastCommit: b.lastCommitDate,
        filesChanged: b.filesChanged.length,
      }));

      const severityOrder = ["low", "medium", "high", "critical"];
      const minIdx = severityOrder.indexOf(minSeverity ?? "low");

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );

  // ── Tool: codeflow_security ───────────────────────────────
  server.tool(
    "codeflow_security",
    "Run security taint analysis",
    {
      path: z.string().optional(),
      severity: z.enum(["critical", "warning", "info"]).optional(),
    },
    async ({ path, severity }) => {
      const { graph } = loadGraph(config.repoPath);
      const engine = new TaintEngine(
        new SourceRegistry(),
        new SinkRegistry(),
        new SanitizerRegistry(),
      );
      const result: SecurityScanResult = engine.scan(new Map(), "default");

      const severityOrder = ["info", "warning", "critical"];
      const minIdx = severityOrder.indexOf(severity ?? "warning");
      let flows = result.flows.filter(
        (f: TaintFlow) => severityOrder.indexOf(f.severity) >= minIdx,
      );
      if (path) {
        flows = flows.filter((f: TaintFlow) =>
          f.path?.[0]?.filePath?.startsWith(path as string),
        );
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(flows, null, 2) },
        ],
      };
    },
  );

  // ── Tool: codeflow_test_impact ────────────────────────────
  server.tool(
    "codeflow_test_impact",
    "Determine which tests to run for changes",
    { diff: z.string().optional(), branch: z.string().optional() },
    async () => {
      const { graph } = loadGraph(config.repoPath);
      const linker = new TestLinker();
      const reverseIndex = linker.link([], graph);
      const totalTests = [...graph.nodes.values()].filter(
        (n) => n.metadata?.isTest,
      ).length;
      const impact = linker.computeImpact([], reverseIndex, graph, totalTests);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(impact, null, 2) },
        ],
      };
    },
  );

  // ── Tool: codeflow_risk ───────────────────────────────────
  server.tool(
    "codeflow_risk",
    "Get risk scores for code",
    { target: z.string().optional(), diff: z.string().optional() },
    async ({ target }) => {
      const { graph, nodeStore } = loadGraph(config.repoPath);
      const scorer = new RiskScorer();

      if (target) {
        const nodes = nodeStore.findByName(target);
        if (nodes.length === 0) {
          return {
            content: [{ type: "text" as const, text: "Symbol not found" }],
          };
        }
        const result = scorer.score(nodes[0]!.id, graph);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      }

      // Top 20 riskiest
      const functions = [...graph.nodes.values()].filter(
        (n) => n.kind === "function" || n.kind === "method",
      );
      const scored = functions
        .map((fn) => {
          try {
            return {
              name: fn.qualifiedName ?? fn.name,
              ...scorer.score(fn.id, graph),
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
        .slice(0, 20);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(scored, null, 2) },
        ],
      };
    },
  );

  // ── Tool: codeflow_schema_impact ──────────────────────────
  server.tool(
    "codeflow_schema_impact",
    "Analyze schema change impact",
    {
      model: z.string(),
      field: z.string(),
      action: z.enum(["rename", "remove", "add"]),
      newName: z.string().optional(),
    },
    async ({ model, field }) => {
      const { graph } = loadGraph(config.repoPath);
      const linker = new SchemaLinker();
      const refs = linker.linkFields([], graph, "default");
      const filtered = refs.filter(
        (r) => r.code.includes(model) && r.code.includes(field),
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(filtered, null, 2) },
        ],
      };
    },
  );

  // ── Tool: codeflow_context ────────────────────────────────
  server.tool(
    "codeflow_context",
    "Get context around a symbol",
    { symbol: z.string(), depth: z.number().optional() },
    async ({ symbol, depth }) => {
      const { graph, nodeStore, edgeStore } = loadGraph(config.repoPath);
      const nodes = nodeStore.findByName(symbol);
      if (nodes.length === 0) {
        return {
          content: [{ type: "text" as const, text: "Symbol not found" }],
        };
      }

      const maxDepth = depth ?? 2;
      const visited = new Set<string>();
      const context: Array<{
        id: string;
        name: string;
        kind: string;
        relation: string;
      }> = [];

      const queue: Array<{ id: string; d: number; relation: string }> = [
        { id: nodes[0]!.id, d: 0, relation: "self" },
      ];

      while (queue.length > 0) {
        const { id, d, relation } = queue.shift()!;
        if (visited.has(id) || d > maxDepth) continue;
        visited.add(id);

        const node = graph.getNode(id);
        if (node) {
          context.push({
            id: node.id,
            name: node.qualifiedName ?? node.name,
            kind: node.kind,
            relation,
          });
        }

        for (const edge of graph.getOutgoingEdges(id)) {
          queue.push({ id: edge.targetId, d: d + 1, relation: edge.kind });
        }
        for (const edge of graph.getIncomingEdges(id)) {
          queue.push({
            id: edge.sourceId,
            d: d + 1,
            relation: `inverse_${edge.kind}`,
          });
        }
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(context, null, 2) },
        ],
      };
    },
  );

  // ── Tool: codeflow_impact ─────────────────────────────────
  server.tool(
    "codeflow_impact",
    "Analyze impact of changing a symbol",
    { symbol: z.string(), depth: z.number().optional() },
    async ({ symbol, depth }) => {
      const { graph, nodeStore } = loadGraph(config.repoPath);
      const nodes = nodeStore.findByName(symbol);
      if (nodes.length === 0) {
        return {
          content: [{ type: "text" as const, text: "Symbol not found" }],
        };
      }

      const maxDepth = depth ?? 3;
      const impacted = new Set<string>();
      const queue: Array<{ id: string; d: number }> = [
        { id: nodes[0]!.id, d: 0 },
      ];

      while (queue.length > 0) {
        const { id, d } = queue.shift()!;
        if (impacted.has(id) || d > maxDepth) continue;
        impacted.add(id);

        // Follow incoming edges (things that depend on this)
        for (const edge of graph.getIncomingEdges(id)) {
          if (
            edge.kind === "calls" ||
            edge.kind === "imports" ||
            edge.kind === "data_flow"
          ) {
            queue.push({ id: edge.sourceId, d: d + 1 });
          }
        }
      }

      const impactedNodes = [...impacted]
        .map((id) => graph.getNode(id))
        .filter(Boolean)
        .map((n) => ({
          name: n!.qualifiedName ?? n!.name,
          kind: n!.kind,
          file: n!.filePath,
        }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(impactedNodes, null, 2),
          },
        ],
      };
    },
  );

  // ── Resource: repo overview ───────────────────────────────
  server.resource("repo-overview", "codeflow://repo/overview", async () => {
    const { graph } = loadGraph(config.repoPath);
    const stats = {
      nodes: graph.nodeCount,
      edges: graph.edgeCount,
      files: graph.getNodesByKind("file").length,
      functions:
        graph.getNodesByKind("function").length +
        graph.getNodesByKind("method").length,
      classes: graph.getNodesByKind("class").length,
      communities: graph.getNodesByKind("community").length,
      processes: graph.getNodesByKind("process").length,
    };
    return {
      contents: [
        {
          uri: "codeflow://repo/overview",
          text: JSON.stringify(stats, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  });

  // ── Resource: branches ────────────────────────────────────
  server.resource("branches", "codeflow://repo/branches", async () => {
    const gitClient = new GitClient(config.repoPath);
    const branches = await gitClient.listBranches();
    return {
      contents: [
        {
          uri: "codeflow://repo/branches",
          text: JSON.stringify(branches, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  });

  // ── Resource: processes ───────────────────────────────────
  server.resource("processes", "codeflow://repo/processes", async () => {
    const { graph } = loadGraph(config.repoPath);
    const processes = graph.getNodesByKind("process").map((n) => ({
      name: n.name,
      file: n.filePath,
    }));
    return {
      contents: [
        {
          uri: "codeflow://repo/processes",
          text: JSON.stringify(processes, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  });

  // ── Resource: security report ─────────────────────────────
  server.resource("security", "codeflow://repo/security", async () => {
    const { graph } = loadGraph(config.repoPath);
    const engine = new TaintEngine(
      new SourceRegistry(),
      new SinkRegistry(),
      new SanitizerRegistry(),
    );
    const result: SecurityScanResult = engine.scan(new Map(), "default");
    const summary = {
      totalFlows: result.flows.length,
      critical: result.flows.filter((f: TaintFlow) => f.severity === "critical")
        .length,
      warning: result.flows.filter((f: TaintFlow) => f.severity === "warning")
        .length,
      info: result.flows.filter((f: TaintFlow) => f.severity === "info").length,
      categories: [...new Set(result.flows.map((f: TaintFlow) => f.category))],
    };
    return {
      contents: [
        {
          uri: "codeflow://repo/security",
          text: JSON.stringify(summary, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  });

  // ── Resource: schema ──────────────────────────────────────
  server.resource("schema", "codeflow://repo/schema", async () => {
    const { graph } = loadGraph(config.repoPath);
    const linker = new SchemaLinker();
    const refs = linker.linkFields([], graph, "default");
    return {
      contents: [
        {
          uri: "codeflow://repo/schema",
          text: JSON.stringify(refs, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  });

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
