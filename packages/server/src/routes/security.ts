import { Hono } from "hono";
import { openDatabase } from "@codeflow/core/storage";
import { InMemoryGraph } from "@codeflow/core/graph/knowledge-graph";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import {
  TaintEngine,
  SourceRegistry,
  SinkRegistry,
  SanitizerRegistry,
} from "@codeflow/core/taint";
import type { TaintFlow } from "@codeflow/core/taint";
import type { AppEnv } from "../types.js";

export const securityRoutes = new Hono<AppEnv>();

securityRoutes.post("/security/scan", async (c) => {
  const body = await c.req.json();
  const { path: scanPath, severity } = body;

  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);

  const graph = new InMemoryGraph();
  for (const n of nodeStore.getAll()) graph.addNode(n);
  for (const e of edgeStore.getAll()) graph.addEdge(e);

  const engine = new TaintEngine(
    new SourceRegistry(),
    new SinkRegistry(),
    new SanitizerRegistry(),
  );
  const result = engine.scan(new Map(), "default");

  const severityOrder = ["info", "warning", "critical"];
  const minIdx = severityOrder.indexOf(severity ?? "warning");
  let flows = result.flows.filter(
    (f: TaintFlow) => severityOrder.indexOf(f.severity) >= minIdx,
  );

  if (scanPath) {
    flows = flows.filter((f: TaintFlow) =>
      f.path[0]?.filePath?.startsWith(scanPath),
    );
  }

  return c.json({
    flows,
    summary: {
      total: flows.length,
      critical: flows.filter((f: TaintFlow) => f.severity === "critical")
        .length,
      warning: flows.filter((f: TaintFlow) => f.severity === "warning").length,
      info: flows.filter((f: TaintFlow) => f.severity === "info").length,
    },
  });
});

securityRoutes.get("/security/report", async (c) => {
  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);

  const graph = new InMemoryGraph();
  for (const n of nodeStore.getAll()) graph.addNode(n);
  for (const e of edgeStore.getAll()) graph.addEdge(e);

  const engine = new TaintEngine(
    new SourceRegistry(),
    new SinkRegistry(),
    new SanitizerRegistry(),
  );
  const result = engine.scan(new Map(), "default");

  const categories = new Map<string, number>();
  for (const flow of result.flows) {
    categories.set(flow.category, (categories.get(flow.category) ?? 0) + 1);
  }

  return c.json({
    totalFlows: result.flows.length,
    critical: result.flows.filter((f: TaintFlow) => f.severity === "critical")
      .length,
    warning: result.flows.filter((f: TaintFlow) => f.severity === "warning")
      .length,
    info: result.flows.filter((f: TaintFlow) => f.severity === "info").length,
    categories: Object.fromEntries(categories),
    topIssues: result.flows
      .filter((f: TaintFlow) => f.severity === "critical")
      .slice(0, 10),
  });
});
