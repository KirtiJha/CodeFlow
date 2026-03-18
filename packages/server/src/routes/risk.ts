import { Hono } from "hono";
import { openDatabase } from "@codeflow/core/storage";
import { InMemoryGraph } from "@codeflow/core/graph/knowledge-graph";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import { RiskScorer } from "@codeflow/core/metrics";
import type { AppEnv } from "../types.js";

export const riskRoutes = new Hono<AppEnv>();

riskRoutes.post("/risk/score", async (c) => {
  const body = await c.req.json();
  const { target } = body;

  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);

  const graph = new InMemoryGraph();
  for (const n of nodeStore.getAll()) graph.addNode(n);
  for (const e of edgeStore.getAll()) graph.addEdge(e);

  const scorer = new RiskScorer();

  if (target) {
    const nodes = nodeStore.findByName(target);
    if (nodes.length === 0) {
      return c.json({ error: "Symbol not found" }, 404);
    }
    return c.json(scorer.score(nodes[0]!.id, graph));
  }

  return c.json({ error: "target required" }, 400);
});

riskRoutes.get("/risk/hotspots", async (c) => {
  const limit = parseInt(c.req.query("limit") ?? "20", 10);

  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);

  const graph = new InMemoryGraph();
  for (const n of nodeStore.getAll()) graph.addNode(n);
  for (const e of edgeStore.getAll()) graph.addEdge(e);

  const scorer = new RiskScorer();
  const functions = [...graph.nodes.values()].filter(
    (n) => n.kind === "function" || n.kind === "method",
  );

  const scored = functions
    .map((fn) => {
      try {
        return {
          name: fn.qualifiedName ?? fn.name,
          file: fn.filePath,
          ...scorer.score(fn.id, graph),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
    .slice(0, limit);

  return c.json({ hotspots: scored });
});
