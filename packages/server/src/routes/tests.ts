import { Hono } from "hono";
import { openDatabase } from "@codeflow/core/storage";
import { InMemoryGraph } from "@codeflow/core/graph/knowledge-graph";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import { TestLinker } from "@codeflow/core/tests";
import type { AppEnv } from "../types.js";

export const testsRoutes = new Hono<AppEnv>();

testsRoutes.post("/tests/impact", async (c) => {
  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);

  const graph = new InMemoryGraph();
  for (const n of nodeStore.getAll()) graph.addNode(n);
  for (const e of edgeStore.getAll()) graph.addEdge(e);

  const linker = new TestLinker();
  const reverseIndex = linker.link([], graph);
  const totalTests = nodeStore.countByKind("test");
  const impact = linker.computeImpact([], reverseIndex, graph, totalTests);

  return c.json(impact);
});

testsRoutes.get("/tests/gaps", async (c) => {
  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);

  const graph = new InMemoryGraph();
  for (const n of nodeStore.getAll()) graph.addNode(n);
  for (const e of edgeStore.getAll()) graph.addEdge(e);

  const linker = new TestLinker();
  const reverseIndex = linker.link([], graph);
  const totalTests = nodeStore.countByKind("test");
  const impact = linker.computeImpact([], reverseIndex, graph, totalTests);

  return c.json({
    gaps: impact.testGaps,
    count: impact.testGaps.length,
  });
});
