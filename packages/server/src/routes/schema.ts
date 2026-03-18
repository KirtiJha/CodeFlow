import { Hono } from "hono";
import { openDatabase } from "@codeflow/core/storage";
import { InMemoryGraph } from "@codeflow/core/graph/knowledge-graph";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import { SchemaLinker } from "@codeflow/core/schema";
import type { AppEnv } from "../types.js";

export const schemaRoutes = new Hono<AppEnv>();

schemaRoutes.get("/schema/models", async (c) => {
  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);

  const graph = new InMemoryGraph();
  for (const n of nodeStore.getAll()) graph.addNode(n);
  for (const e of edgeStore.getAll()) graph.addEdge(e);

  const linker = new SchemaLinker();
  const refs = linker.linkFields([], graph, "default");

  return c.json({ refs, count: refs.length });
});

schemaRoutes.post("/schema/impact", async (c) => {
  const body = await c.req.json();
  const { model, field, action } = body;

  if (!model || !field || !action) {
    return c.json({ error: "model, field, and action required" }, 400);
  }

  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);

  const graph = new InMemoryGraph();
  for (const n of nodeStore.getAll()) graph.addNode(n);
  for (const e of edgeStore.getAll()) graph.addEdge(e);

  const linker = new SchemaLinker();
  const references = linker
    .linkFields([], graph, "default")
    .filter((r) => r.code.includes(model) && r.code.includes(field));

  return c.json({
    model,
    field,
    action,
    references,
    impactCount: references.length,
  });
});
