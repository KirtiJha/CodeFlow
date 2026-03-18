import { Hono } from "hono";
import { openDatabase } from "@codeflow/core/storage";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import type { AppEnv } from "../types.js";

export const traceRoutes = new Hono<AppEnv>();

traceRoutes.post("/trace", async (c) => {
  const body = await c.req.json();
  const { from, to, file, line } = body;

  if (!file && !from) {
    return c.json({ error: "file or from required" }, 400);
  }

  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);

  // Find source node
  let sourceNodes;
  if (from) {
    sourceNodes = nodeStore.findByName(from);
  } else if (line) {
    sourceNodes = nodeStore.findByFileAndLine(file, line);
  } else {
    sourceNodes = nodeStore.findByFile(file);
  }

  if (!sourceNodes || sourceNodes.length === 0) {
    return c.json({ error: "Source symbol not found" }, 404);
  }

  // BFS trace
  const traces: Array<{
    path: Array<{ name: string; file: string; kind: string }>;
    depth: number;
  }> = [];
  const visited = new Set<string>();
  const queue: Array<{
    nodeId: string;
    path: Array<{ name: string; file: string; kind: string }>;
    depth: number;
  }> = [];

  for (const node of sourceNodes.slice(0, 1)) {
    queue.push({
      nodeId: node.id,
      path: [
        {
          name: node.qualifiedName ?? node.name,
          file: node.filePath,
          kind: node.kind,
        },
      ],
      depth: 0,
    });
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.nodeId) || current.depth > 8) continue;
    visited.add(current.nodeId);

    const outgoing = edgeStore.getOutgoing(current.nodeId, "data_flow");
    if (outgoing.length === 0) {
      traces.push({ path: current.path, depth: current.depth });
    }

    for (const edge of outgoing) {
      const target = nodeStore.getById(edge.targetId);
      if (target) {
        queue.push({
          nodeId: target.id,
          path: [
            ...current.path,
            {
              name: target.qualifiedName ?? target.name,
              file: target.filePath,
              kind: target.kind,
            },
          ],
          depth: current.depth + 1,
        });
      }
    }
  }

  return c.json({ traces, count: traces.length });
});
