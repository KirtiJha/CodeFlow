import { Hono } from "hono";
import { openDatabase } from "@codeflow/core/storage";
import { InMemoryGraph } from "@codeflow/core/graph/knowledge-graph";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import { HybridSearch } from "@codeflow/core/search";
import type { AppEnv } from "../types.js";

export const searchRoutes = new Hono<AppEnv>();

// Get full knowledge graph (nodes + edges)
searchRoutes.get("/graph", async (c) => {
  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);

  const nodes = nodeStore.getAll().map((n) => ({
    id: n.id,
    name: n.name,
    kind: n.kind,
    file: n.filePath,
    line: n.startLine ?? 0,
    language: n.language ?? "unknown",
  }));

  const edges = edgeStore.getAll().map((e) => ({
    source: e.sourceId,
    target: e.targetId,
    kind: e.kind,
  }));

  return c.json({ data: { nodes, edges } });
});

searchRoutes.post("/search", async (c) => {
  const body = await c.req.json();
  const { query, limit } = body;

  if (!query) {
    return c.json({ error: "query required" }, 400);
  }

  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  const search = new HybridSearch(db);
  await search.initialize();

  const results = search.search(query, limit ?? 20);
  return c.json({ results, count: results.length });
});

searchRoutes.post("/context", async (c) => {
  const body = await c.req.json();
  const { symbol, depth } = body;

  if (!symbol) {
    return c.json({ error: "symbol required" }, 400);
  }

  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);

  const graph = new InMemoryGraph();
  for (const n of nodeStore.getAll()) graph.addNode(n);
  for (const e of edgeStore.getAll()) graph.addEdge(e);

  const nodes = nodeStore.findByName(symbol);
  if (nodes.length === 0) {
    return c.json({ error: "Symbol not found" }, 404);
  }

  const maxDepth = depth ?? 2;
  const visited = new Set<string>();
  const context: Array<{
    id: string;
    name: string;
    kind: string;
    relation: string;
    file: string;
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
        file: node.filePath,
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

  return c.json({ context, count: context.length });
});

searchRoutes.post("/impact", async (c) => {
  const body = await c.req.json();
  const { symbol, depth } = body;

  if (!symbol) {
    return c.json({ error: "symbol required" }, 400);
  }

  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);

  const graph = new InMemoryGraph();
  for (const n of nodeStore.getAll()) graph.addNode(n);
  for (const e of edgeStore.getAll()) graph.addEdge(e);

  const nodes = nodeStore.findByName(symbol);
  if (nodes.length === 0) {
    return c.json({ error: "Symbol not found" }, 404);
  }

  const maxDepth = depth ?? 3;
  const impacted = new Set<string>();
  const queue: Array<{ id: string; d: number }> = [{ id: nodes[0]!.id, d: 0 }];

  while (queue.length > 0) {
    const { id, d } = queue.shift()!;
    if (impacted.has(id) || d > maxDepth) continue;
    impacted.add(id);

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

  return c.json({ impacted: impactedNodes, count: impactedNodes.length });
});
