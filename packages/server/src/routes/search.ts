import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { resolve, normalize } from "node:path";
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
    language: (n.language && (n.language as string) !== "unknown") ? n.language : detectLanguage(n.filePath),
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
  const nodeStore = new NodeStore(db);
  const search = new HybridSearch(db);
  await search.initialize();

  const raw = search.search(query, limit ?? 20);
  // Map HybridResult to the shape the frontend SearchResult expects
  const results = raw.map((r) => {
    const node = nodeStore.getById(r.nodeId);
    return {
      id: r.nodeId,
      name: r.name,
      kind: node?.kind ?? "unknown",
      file: r.filePath,
      line: node?.startLine ?? 0,
      score: r.score,
      snippet: node?.qualifiedName ?? r.qualifiedName,
    };
  });
  return c.json({ data: { results }, status: "ok" });
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

// Read source code snippet for a file
searchRoutes.post("/source", async (c) => {
  const body = await c.req.json();
  const { file, startLine, endLine } = body;

  if (!file || typeof file !== "string") {
    return c.json({ error: "file required" }, 400);
  }

  const repoPath = c.get("repoPath");
  const absPath = resolve(repoPath, normalize(file));

  // Prevent path traversal outside the repo
  if (!absPath.startsWith(repoPath)) {
    return c.json({ error: "invalid file path" }, 400);
  }

  try {
    const content = readFileSync(absPath, "utf-8");
    const lines = content.split("\n");

    const start = Math.max(0, (startLine ?? 1) - 1);
    const end = Math.min(lines.length, endLine ?? lines.length);
    const snippet = lines.slice(start, end).join("\n");

    return c.json({
      data: { file, content: snippet, startLine: start + 1, endLine: end, totalLines: lines.length },
    });
  } catch {
    return c.json({ error: "File not found" }, 404);
  }
});

// Get enriched detail for a node: full file source + sibling nodes + relationships
searchRoutes.post("/node-detail", async (c) => {
  const body = await c.req.json();
  const { nodeId } = body;

  if (!nodeId || typeof nodeId !== "string") {
    return c.json({ error: "nodeId required" }, 400);
  }

  const repoPath = c.get("repoPath");
  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);

  const node = nodeStore.getById(nodeId);
  if (!node) {
    return c.json({ error: "Node not found" }, 404);
  }

  // Read full file source
  let fileContent = "";
  let totalLines = 0;
  const lines: string[] = [];
  try {
    const absPath = resolve(repoPath, normalize(node.filePath));
    if (absPath.startsWith(repoPath)) {
      fileContent = readFileSync(absPath, "utf-8");
      lines.push(...fileContent.split("\n"));
      totalLines = lines.length;
    }
  } catch {
    // file not readable
  }

  // Resolve line numbers from source when the DB has none
  function resolveLine(name: string, kind: string): { line: number; endLine: number } {
    if (lines.length === 0) return { line: 0, endLine: 0 };
    // Build patterns ordered by specificity
    const patterns: RegExp[] = [];
    if (kind === "class") {
      patterns.push(new RegExp(`\\bclass\\s+${escapeRe(name)}\\b`));
    } else if (kind === "interface") {
      patterns.push(new RegExp(`\\binterface\\s+${escapeRe(name)}\\b`));
    } else if (kind === "type_alias") {
      patterns.push(new RegExp(`\\btype\\s+${escapeRe(name)}\\b`));
    } else if (kind === "enum") {
      patterns.push(new RegExp(`\\benum\\s+${escapeRe(name)}\\b`));
    }
    // Generic patterns for functions / arrow functions / variables
    patterns.push(
      new RegExp(`\\bfunction\\s+${escapeRe(name)}\\b`),
      new RegExp(`\\b(?:const|let|var)\\s+${escapeRe(name)}\\b`),
      new RegExp(`\\b${escapeRe(name)}\\s*[=(:]`),
    );
    for (const pat of patterns) {
      for (let i = 0; i < lines.length; i++) {
        if (pat.test(lines[i]!)) {
          // Estimate end line: scan forward for matching braces or next definition
          let endLine = i + 1;
          let depth = 0;
          let foundOpen = false;
          for (let j = i; j < lines.length; j++) {
            for (const ch of lines[j]!) {
              if (ch === "{") { depth++; foundOpen = true; }
              if (ch === "}") depth--;
            }
            if (foundOpen && depth <= 0) { endLine = j + 1; break; }
            endLine = j + 1;
          }
          return { line: i + 1, endLine };
        }
      }
    }
    return { line: 0, endLine: 0 };
  }

  function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // Resolve main node line
  const nodeLine = node.startLine ?? 0;
  const nodeEndLine = node.endLine ?? 0;
  const resolved = nodeLine === 0 ? resolveLine(node.name, node.kind) : { line: nodeLine, endLine: nodeEndLine || nodeLine };

  // Detect language from file extension when DB says "unknown"
  const detectedLang = node.language && (node.language as string) !== "unknown"
    ? node.language
    : detectLanguage(node.filePath);

  // All nodes defined in the same file (siblings)
  const siblings = nodeStore.findByFile(node.filePath).map((n) => {
    const sl = n.startLine ?? 0;
    const el = n.endLine ?? 0;
    const r = sl === 0 ? resolveLine(n.name, n.kind) : { line: sl, endLine: el || sl };
    const lang = n.language && (n.language as string) !== "unknown" ? n.language : detectedLang;
    return {
      id: n.id,
      name: n.name,
      kind: n.kind,
      line: r.line,
      endLine: r.endLine,
      language: lang,
      isTest: !!n.isTest,
      isEntryPoint: !!n.isEntryPoint,
      signature: n.signature ?? null,
    };
  });

  // Outgoing edges (this node → targets)
  const outEdges = edgeStore.getOutgoing(nodeId);
  const callees = outEdges.map((e) => {
    const target = nodeStore.getById(e.targetId);
    return {
      id: e.targetId,
      name: target?.name ?? "?",
      kind: target?.kind ?? "unknown",
      edgeKind: e.kind,
      file: target?.filePath ?? "",
      line: target?.startLine ?? 0,
    };
  });

  // Incoming edges (callers → this node)
  const inEdges = (
    db
      .prepare("SELECT * FROM edges WHERE target_id = ?")
      .all(nodeId) as Array<{
        id: string;
        source_id: string;
        target_id: string;
        kind: string;
      }>
  );
  const callers = inEdges.map((e) => {
    const source = nodeStore.getById(e.source_id);
    return {
      id: e.source_id,
      name: source?.name ?? "?",
      kind: source?.kind ?? "unknown",
      edgeKind: e.kind,
      file: source?.filePath ?? "",
      line: source?.startLine ?? 0,
    };
  });

  return c.json({
    data: {
      node: {
        id: node.id,
        name: node.name,
        qualifiedName: node.qualifiedName,
        kind: node.kind,
        file: node.filePath,
        line: resolved.line,
        endLine: resolved.endLine,
        language: detectedLang,
        signature: node.signature,
        isTest: !!node.isTest,
        isEntryPoint: !!node.isEntryPoint,
        riskScore: node.riskScore ?? 0,
        complexity: node.complexityCyclomatic ?? 0,
      },
      fileContent,
      totalLines,
      siblings,
      callees,
      callers,
    },
  });
});

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    py: "python", java: "java", go: "go", rs: "rust",
    rb: "ruby", cs: "csharp", cpp: "cpp", c: "c",
    swift: "swift", kt: "kotlin", php: "php",
    json: "json", yaml: "yaml", yml: "yaml", sql: "sql",
    md: "markdown", html: "html", css: "css", scss: "scss",
  };
  return map[ext] ?? "text";
}
