import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { resolve, normalize } from "node:path";
import { openDatabase } from "@codeflow/core/storage";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import type { AppEnv } from "../types.js";

export const traceRoutes = new Hono<AppEnv>();

type Direction = "forward" | "backward" | "both";

interface RuntimeEventInput {
  timestamp?: number;
  kind?: string;
  fromNodeId?: string;
  toNodeId?: string;
  from?: string;
  to?: string;
  fromFile?: string;
  toFile?: string;
  fromLine?: number;
  toLine?: number;
  metadata?: Record<string, unknown>;
}

interface RuntimeEdgeRow {
  id: string;
  session_id: string;
  source_key: string;
  target_key: string;
  source_node_id: string | null;
  target_node_id: string | null;
  source_symbol: string | null;
  target_symbol: string | null;
  source_file: string | null;
  source_line: number | null;
  target_file: string | null;
  target_line: number | null;
  kind: string;
  source_type: "observed" | "bootstrapped";
  hit_count: number;
  first_seen_ms: number;
  last_seen_ms: number;
}

interface RuntimeSessionRow {
  id: string;
  created_at_ms: number;
  updated_at_ms: number;
  edge_count: number;
  observed_edge_count: number;
  bootstrapped_edge_count: number;
}

traceRoutes.post("/trace", async (c) => {
  const body = await c.req.json();
  const {
    from,
    symbol,
    file,
    line,
    depth = 5,
    direction = "forward",
    includeTests = false,
    edgeKinds = [],
  } = body as {
    from?: string;
    symbol?: string;
    file?: string;
    line?: number;
    depth?: number;
    direction?: Direction;
    includeTests?: boolean;
    edgeKinds?: string[];
  };

  const sourceSymbol = (symbol ?? from ?? "").trim();
  if (!file && !sourceSymbol) {
    return c.json({ error: "symbol/from or file required" }, 400);
  }

  const dbPath = c.get("dbPath");
  const repoPath = c.get("repoPath");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);

  const fileLinesCache = new Map<string, string[]>();
  const loadLines = (relPath: string): string[] => {
    if (fileLinesCache.has(relPath)) return fileLinesCache.get(relPath)!;
    try {
      const absPath = resolve(repoPath, normalize(relPath));
      if (!absPath.startsWith(repoPath)) return [];
      const content = readFileSync(absPath, "utf-8");
      const lines = content.split("\n");
      fileLinesCache.set(relPath, lines);
      return lines;
    } catch {
      return [];
    }
  };

  const resolveLine = (relPath: string, kind: string, rawName: string): number => {
    const lines = loadLines(relPath);
    if (lines.length === 0) return 0;
    const name = rawName.includes("::") ? rawName.split("::").pop() ?? rawName : rawName;
    const safe = escapeRe(name);

    const patterns: RegExp[] = [];
    if (kind === "class") patterns.push(new RegExp(`\\bclass\\s+${safe}\\b`));
    if (kind === "interface") patterns.push(new RegExp(`\\binterface\\s+${safe}\\b`));
    if (kind === "method" || kind === "function") {
      patterns.push(
        new RegExp(`\\bfunction\\s+${safe}\\b`),
        new RegExp(`\\b${safe}\\s*\\(`),
      );
    }
    patterns.push(new RegExp(`\\b${safe}\\b`));

    for (const pat of patterns) {
      for (let i = 0; i < lines.length; i++) {
        if (pat.test(lines[i]!)) return i + 1;
      }
    }
    return 0;
  };

  const snippetForLine = (relPath: string, lineNo: number): string => {
    const lines = loadLines(relPath);
    if (lines.length === 0) return "";
    if (lineNo <= 0) return lines.slice(0, 20).join("\n");
    const start = Math.max(1, lineNo - 3);
    const end = Math.min(lines.length, lineNo + 12);
    return lines.slice(start - 1, end).join("\n");
  };

  let sourceNodes = [];
  if (sourceSymbol) {
    sourceNodes = nodeStore.findByName(sourceSymbol);
    if (sourceNodes.length === 0) {
      const q = sourceSymbol.toLowerCase();
      sourceNodes = nodeStore
        .getAll()
        .filter(
          (n) =>
            n.name.toLowerCase().includes(q) ||
            (n.qualifiedName ?? "").toLowerCase().includes(q),
        )
        .slice(0, 10);
    }
  } else if (line) {
    sourceNodes = nodeStore.findByFileAndLine(file ?? "", line);
  } else {
    sourceNodes = nodeStore.findByFile(file ?? "");
  }

  if (!sourceNodes || sourceNodes.length === 0) {
    return c.json({ error: "Source symbol not found" }, 404);
  }

  const maxDepth = Math.max(1, Math.min(10, Number(depth) || 5));
  const requestedDirection: Direction =
    direction === "backward" || direction === "both" ? direction : "forward";
  let traceDirection: Direction = requestedDirection;
  const selectedEdgeKinds = new Set(
    (edgeKinds ?? []).map((k) => String(k).trim()).filter(Boolean),
  );

  const shouldIncludeEdgeKind = (kind: string): boolean => {
    if (selectedEdgeKinds.size === 0) return true;
    return selectedEdgeKinds.has(kind);
  };

  const visitedByDepth = new Map<string, number>();
  const queue: Array<{ nodeId: string; depth: number }> = [];
  const traceNodes = new Map<
    string,
    {
      id: string;
      name: string;
      kind: string;
      file: string;
      line: number;
      endLine?: number;
      column: number;
      depth: number;
      language: string;
      codeSnippet?: string;
    }
  >();
  const traceEdges = new Map<
    string,
    {
      id: string;
      source: string;
      target: string;
      kind: string;
      weight: number;
    }
  >();

  const runTraversal = (directionMode: Direction) => {
    visitedByDepth.clear();
    queue.length = 0;
    traceNodes.clear();
    traceEdges.clear();

    for (const node of sourceNodes.slice(0, 5)) {
      queue.push({ nodeId: node.id, depth: 0 });
      traceNodes.set(node.id, {
        id: node.id,
        name: node.qualifiedName ?? node.name,
        kind: node.kind,
        file: node.filePath,
        line: node.startLine ?? 0,
        endLine: node.endLine ?? undefined,
        column: 0,
        depth: 0,
        language: node.language ?? "typescript",
      });
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const prevDepth = visitedByDepth.get(current.nodeId);
      if (current.depth > maxDepth) continue;
      if (prevDepth != null && prevDepth <= current.depth) continue;
      visitedByDepth.set(current.nodeId, current.depth);

      const nextEdges = [];
      if (directionMode === "forward" || directionMode === "both") {
        nextEdges.push(...edgeStore.getOutgoing(current.nodeId));
      }
      if (directionMode === "backward" || directionMode === "both") {
        nextEdges.push(...edgeStore.getByTarget(current.nodeId));
      }

      for (const edge of nextEdges) {
        if (!shouldIncludeEdgeKind(edge.kind)) continue;

        const isBackward = edge.targetId === current.nodeId;
        const nextId = isBackward ? edge.sourceId : edge.targetId;
        const sourceId = edge.sourceId;
        const targetId = edge.targetId;

        const nextNode = nodeStore.getById(nextId);
        if (!nextNode) continue;
        if (!includeTests && nextNode.isTest) continue;

        traceNodes.set(nextNode.id, {
          id: nextNode.id,
          name: nextNode.qualifiedName ?? nextNode.name,
          kind: nextNode.kind,
          file: nextNode.filePath,
          line: nextNode.startLine ?? 0,
          endLine: nextNode.endLine ?? undefined,
          column: 0,
          depth: Math.min(current.depth + 1, traceNodes.get(nextNode.id)?.depth ?? Infinity),
          language: nextNode.language ?? "typescript",
        });

        const edgeId = `${sourceId}->${targetId}:${edge.kind}`;
        traceEdges.set(edgeId, {
          id: edgeId,
          source: sourceId,
          target: targetId,
          kind: edge.kind,
          weight: edge.confidence ?? 1,
        });

        if (current.depth < maxDepth) {
          queue.push({ nodeId: nextNode.id, depth: current.depth + 1 });
        }
      }
    }
  };

  runTraversal(traceDirection);

  let fallbackUsed = false;
  if (traceEdges.size === 0 && traceDirection !== "both") {
    runTraversal("both");
    traceDirection = "both";
    fallbackUsed = true;
  }

  for (const [id, node] of traceNodes) {
    const full = nodeStore.getById(id);
    const resolvedLine =
      full?.startLine && full.startLine > 0
        ? full.startLine
        : resolveLine(node.file, node.kind, full?.name ?? node.name);

    traceNodes.set(id, {
      ...node,
      line: resolvedLine,
      language: (full?.language as string) ?? node.language,
      codeSnippet: snippetForLine(node.file, resolvedLine),
    });
  }

  return c.json({
    data: {
      nodes: Array.from(traceNodes.values()),
      edges: Array.from(traceEdges.values()),
      depth: maxDepth,
      direction: traceDirection,
      mode: "static",
      requestedDirection,
      fallbackUsed,
    },
  });
});

traceRoutes.post("/trace/runtime/events", async (c) => {
  const body = await c.req.json();
  const payload = body as { sessionId?: string; events?: RuntimeEventInput[] } | RuntimeEventInput[];
  const sessionId =
    (Array.isArray(payload) ? undefined : payload.sessionId)?.trim() ||
    c.req.header("x-trace-session-id")?.trim() ||
    "default";
  const events = Array.isArray(payload) ? payload : payload.events ?? [];

  if (!Array.isArray(events) || events.length === 0) {
    return c.json({ error: "events[] required" }, 400);
  }

  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  ensureRuntimeTables(db);
  const nodeStore = new NodeStore(db);

  const now = Date.now();
  const upsertSession = db.prepare(
    `INSERT INTO runtime_sessions (id, created_at_ms, updated_at_ms)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET updated_at_ms = excluded.updated_at_ms`,
  );
  const getEdge = db.prepare(
    `SELECT id, hit_count FROM runtime_edges WHERE id = ?`,
  );
  const insertEdge = db.prepare(
    `INSERT INTO runtime_edges
      (id, session_id, source_key, target_key, source_node_id, target_node_id,
       source_symbol, target_symbol, source_file, source_line, target_file, target_line,
       kind, source_type, hit_count, first_seen_ms, last_seen_ms, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const updateEdge = db.prepare(
    `UPDATE runtime_edges
     SET hit_count = ?, source_type = 'observed', last_seen_ms = ?, metadata_json = ?
     WHERE id = ?`,
  );

  upsertSession.run(sessionId, now, now);

  const tx = db.transaction((items: RuntimeEventInput[]) => {
    for (const event of items) {
      const ts = Number(event.timestamp) > 0 ? Number(event.timestamp) : now;
      const kind = (event.kind ?? "runtime_call").trim() || "runtime_call";
      const fromNode = resolveRuntimeNode(nodeStore, {
        nodeId: event.fromNodeId,
        symbol: event.from,
        file: event.fromFile,
        line: event.fromLine,
      });
      const toNode = resolveRuntimeNode(nodeStore, {
        nodeId: event.toNodeId,
        symbol: event.to,
        file: event.toFile,
        line: event.toLine,
      });

      const sourceKey = runtimeKey(fromNode?.id, event.from, event.fromFile, event.fromLine);
      const targetKey = runtimeKey(toNode?.id, event.to, event.toFile, event.toLine);
      if (!sourceKey || !targetKey) continue;

      const edgeId = `${sessionId}:${kind}:${sourceKey}->${targetKey}`;
      const existing = getEdge.get(edgeId) as { id: string; hit_count: number } | undefined;
      const metadataJson = JSON.stringify({
        ...(event.metadata ?? {}),
        sourceType: "observed",
      });

      if (!existing) {
        insertEdge.run(
          edgeId,
          sessionId,
          sourceKey,
          targetKey,
          fromNode?.id ?? null,
          toNode?.id ?? null,
          event.from ?? fromNode?.qualifiedName ?? fromNode?.name ?? null,
          event.to ?? toNode?.qualifiedName ?? toNode?.name ?? null,
          event.fromFile ?? fromNode?.filePath ?? null,
          event.fromLine ?? fromNode?.startLine ?? null,
          event.toFile ?? toNode?.filePath ?? null,
          event.toLine ?? toNode?.startLine ?? null,
          kind,
          "observed",
          1,
          ts,
          ts,
          metadataJson,
        );
      } else {
        updateEdge.run(existing.hit_count + 1, ts, metadataJson, edgeId);
      }
    }
  });

  tx(events);

  return c.json({ data: { sessionId, ingested: events.length } });
});

traceRoutes.post("/trace/runtime", async (c) => {
  const body = await c.req.json();
  const {
    from,
    symbol,
    depth = 5,
    direction = "forward",
    includeTests = false,
    edgeKinds = [],
    sessionId,
    lookbackMinutes = 60,
    observedOnly = false,
  } = body as {
    from?: string;
    symbol?: string;
    depth?: number;
    direction?: Direction;
    includeTests?: boolean;
    edgeKinds?: string[];
    sessionId?: string;
    lookbackMinutes?: number;
    observedOnly?: boolean;
  };

  const sourceSymbol = (symbol ?? from ?? "").trim();
  if (!sourceSymbol) {
    return c.json({ error: "symbol/from required for runtime trace" }, 400);
  }

  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  ensureRuntimeTables(db);
  const nodeStore = new NodeStore(db);

  const sid = (sessionId ?? "").trim() || "default";
  const lookbackMs = Math.max(1, Number(lookbackMinutes) || 60) * 60_000;
  const minSeen = Date.now() - lookbackMs;

  let rows = db
    .prepare(
      `SELECT id, session_id, source_key, target_key, source_node_id, target_node_id,
              source_symbol, target_symbol, source_file, source_line, target_file, target_line,
              kind, source_type, hit_count, first_seen_ms, last_seen_ms
       FROM runtime_edges
       WHERE session_id = ? AND last_seen_ms >= ?`,
    )
    .all(sid, minSeen) as RuntimeEdgeRow[];

  if (rows.length === 0) {
    // Auto-bootstrap a starter runtime session from static graph edges,
    // so runtime mode is immediately usable before explicit instrumentation.
    const generated = observedOnly
      ? 0
      : bootstrapRuntimeSessionFromStaticGraph({
          db,
          nodeStore,
          edgeStore: new EdgeStore(db),
          sessionId: sid,
          symbol: sourceSymbol,
          nowMs: Date.now(),
        });

    if (generated > 0) {
      rows = db
        .prepare(
          `SELECT id, session_id, source_key, target_key, source_node_id, target_node_id,
                  source_symbol, target_symbol, source_file, source_line, target_file, target_line,
              kind, source_type, hit_count, first_seen_ms, last_seen_ms
           FROM runtime_edges
           WHERE session_id = ? AND last_seen_ms >= ?`,
        )
        .all(sid, minSeen) as RuntimeEdgeRow[];
    }

    if (rows.length === 0) {
      return c.json(
        {
          error:
            `No runtime events found for session '${sid}'. ` +
            "Ingest events with POST /api/trace/runtime/events first.",
        },
        404,
      );
    }
  }

  const maxDepth = Math.max(1, Math.min(10, Number(depth) || 5));
  const requestedDirection: Direction =
    direction === "backward" || direction === "both" ? direction : "forward";
  let traceDirection: Direction = requestedDirection;
  const selectedEdgeKinds = new Set((edgeKinds ?? []).map((k) => String(k).trim()).filter(Boolean));

  const filteredRows = rows.filter((r) => selectedEdgeKinds.size === 0 || selectedEdgeKinds.has(r.kind));
  const modeFilteredRows = observedOnly
    ? filteredRows.filter((r) => r.source_type === "observed")
    : filteredRows;

  if (modeFilteredRows.length === 0) {
    return c.json(
      {
        error: observedOnly
          ? `No observed runtime edges found for session '${sid}'. Turn off observed-only or ingest runtime events.`
          : `No runtime edges found for session '${sid}' with the selected filters.`,
      },
      404,
    );
  }

  const sourceNodes = nodeStore.findByName(sourceSymbol);
  const sourceNodeIds = new Set(sourceNodes.map((n) => n.id));
  const seedKeys = new Set<string>();
  for (const row of modeFilteredRows) {
    if (row.source_node_id && sourceNodeIds.has(row.source_node_id)) {
      seedKeys.add(row.source_key);
    }
    if (row.target_node_id && sourceNodeIds.has(row.target_node_id)) {
      seedKeys.add(row.target_key);
    }
    if (equalsCi(row.source_symbol, sourceSymbol)) seedKeys.add(row.source_key);
    if (equalsCi(row.target_symbol, sourceSymbol)) seedKeys.add(row.target_key);
  }

  if (seedKeys.size === 0) {
    return c.json(
      {
        error:
          `No runtime edges matched symbol '${sourceSymbol}' in session '${sid}'. ` +
          "Verify the symbol appears in ingested runtime events.",
      },
      404,
    );
  }

  const hintByKey = new Map<string, { symbol?: string; file?: string; line?: number }>();
  for (const row of modeFilteredRows) {
    if (!hintByKey.has(row.source_key)) {
      hintByKey.set(row.source_key, {
        symbol: row.source_symbol ?? undefined,
        file: row.source_file ?? undefined,
        line: row.source_line ?? undefined,
      });
    }
    if (!hintByKey.has(row.target_key)) {
      hintByKey.set(row.target_key, {
        symbol: row.target_symbol ?? undefined,
        file: row.target_file ?? undefined,
        line: row.target_line ?? undefined,
      });
    }
  }

  const traceNodes = new Map<
    string,
    {
      id: string;
      name: string;
      kind: string;
      file: string;
      line: number;
      endLine?: number;
      column: number;
      depth: number;
      language: string;
      codeSnippet?: string;
    }
  >();
  const traceEdges = new Map<string, { id: string; source: string; target: string; kind: string; weight: number }>();
  const traceEdgeSources = new Map<string, "observed" | "bootstrapped">();

  const runTraversal = (dir: Direction) => {
    traceNodes.clear();
    traceEdges.clear();

    const visitedByDepth = new Map<string, number>();
    const queue: Array<{ key: string; depth: number }> = [];

    for (const seed of seedKeys) {
      queue.push({ key: seed, depth: 0 });
      const node = buildRuntimeTraceNode(seed, 0, nodeStore, hintByKey);
      traceNodes.set(seed, node);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth > maxDepth) continue;
      const prevDepth = visitedByDepth.get(current.key);
      if (prevDepth != null && prevDepth <= current.depth) continue;
      visitedByDepth.set(current.key, current.depth);

      for (const row of modeFilteredRows) {
        let nextKey: string | null = null;
        let edgeSource = row.source_key;
        let edgeTarget = row.target_key;

        if (dir === "forward" || dir === "both") {
          if (row.source_key === current.key) {
            nextKey = row.target_key;
          }
        }
        if (!nextKey && (dir === "backward" || dir === "both")) {
          if (row.target_key === current.key) {
            nextKey = row.source_key;
            edgeSource = row.source_key;
            edgeTarget = row.target_key;
          }
        }

        if (!nextKey) continue;
        if (!includeTests && isRuntimeTestKey(nextKey, nodeStore)) continue;

        const existing = traceNodes.get(nextKey);
        const nextDepth = current.depth + 1;
        const node = buildRuntimeTraceNode(nextKey, nextDepth, nodeStore, hintByKey);
        traceNodes.set(nextKey, {
          ...node,
          depth: Math.min(existing?.depth ?? Number.POSITIVE_INFINITY, nextDepth),
        });

        const id = `${row.id}:${edgeSource}->${edgeTarget}`;
        traceEdges.set(id, {
          id,
          source: edgeSource,
          target: edgeTarget,
          kind: row.kind,
          weight: row.hit_count,
        });
        traceEdgeSources.set(id, row.source_type);

        if (current.depth < maxDepth) {
          queue.push({ key: nextKey, depth: nextDepth });
        }
      }
    }
  };

  runTraversal(traceDirection);

  let fallbackUsed = false;
  if (traceEdges.size === 0 && traceDirection !== "both") {
    runTraversal("both");
    traceDirection = "both";
    fallbackUsed = true;
  }

  let observedEdgeCount = 0;
  let bootstrappedEdgeCount = 0;
  for (const edgeId of traceEdges.keys()) {
    const sourceType = traceEdgeSources.get(edgeId);
    if (sourceType === "observed") observedEdgeCount++;
    else if (sourceType === "bootstrapped") bootstrappedEdgeCount++;
  }

  const runtimeSource: "observed" | "bootstrapped" | "mixed" =
    observedEdgeCount > 0 && bootstrappedEdgeCount > 0
      ? "mixed"
      : observedEdgeCount > 0
        ? "observed"
        : "bootstrapped";

  return c.json({
    data: {
      nodes: Array.from(traceNodes.values()),
      edges: Array.from(traceEdges.values()),
      depth: maxDepth,
      direction: traceDirection,
      mode: "runtime",
      sessionId: sid,
      runtimeSource,
      observedEdgeCount,
      bootstrappedEdgeCount,
      requestedDirection,
      fallbackUsed,
    },
  });
});

traceRoutes.get("/trace/runtime/sessions", async (c) => {
  const limit = Math.max(1, Math.min(100, Number(c.req.query("limit") ?? "20") || 20));

  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  ensureRuntimeTables(db);

  const rows = db
    .prepare(
      `SELECT s.id,
              s.created_at_ms,
              s.updated_at_ms,
              COUNT(e.id) AS edge_count,
              COALESCE(SUM(CASE WHEN e.source_type = 'observed' THEN 1 ELSE 0 END), 0) AS observed_edge_count,
              COALESCE(SUM(CASE WHEN e.source_type = 'bootstrapped' THEN 1 ELSE 0 END), 0) AS bootstrapped_edge_count
       FROM runtime_sessions s
       LEFT JOIN runtime_edges e ON e.session_id = s.id
       GROUP BY s.id, s.created_at_ms, s.updated_at_ms
       ORDER BY s.updated_at_ms DESC
       LIMIT ?`,
    )
    .all(limit) as RuntimeSessionRow[];

  return c.json({ data: { sessions: rows } });
});

traceRoutes.get("/trace/runtime/suggest", async (c) => {
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(30, Number(c.req.query("limit") ?? "10") || 10));
  const sessionId = (c.req.query("sessionId") ?? "").trim() || "default";

  if (!q) {
    return c.json({ data: { suggestions: [] } });
  }

  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  ensureRuntimeTables(db);
  const nodeStore = new NodeStore(db);

  const rows = db
    .prepare(
      `SELECT source_symbol, target_symbol, source_file, target_file,
              source_line, target_line, last_seen_ms
       FROM runtime_edges
       WHERE session_id = ?
         AND (
           lower(coalesce(source_symbol, '')) LIKE ?
           OR lower(coalesce(target_symbol, '')) LIKE ?
         )
       ORDER BY last_seen_ms DESC
       LIMIT 500`,
    )
    .all(sessionId, `%${q}%`, `%${q}%`) as Array<{
    source_symbol: string | null;
    target_symbol: string | null;
    source_file: string | null;
    target_file: string | null;
    source_line: number | null;
    target_line: number | null;
    last_seen_ms: number;
  }>;

  const bySymbol = new Map<string, { file: string; line: number; last: number }>();
  for (const row of rows) {
    const options: Array<{ symbol: string | null; file: string | null; line: number | null }> = [
      { symbol: row.source_symbol, file: row.source_file, line: row.source_line },
      { symbol: row.target_symbol, file: row.target_file, line: row.target_line },
    ];

    for (const option of options) {
      const symbol = (option.symbol ?? "").trim();
      if (!symbol) continue;
      if (!symbol.toLowerCase().includes(q)) continue;
      if (bySymbol.has(symbol)) continue;
      bySymbol.set(symbol, {
        file: option.file ?? "",
        line: option.line ?? 0,
        last: row.last_seen_ms,
      });
    }
  }

  const runtimeSuggestions = Array.from(bySymbol.entries())
    .sort((a, b) => b[1].last - a[1].last)
    .slice(0, limit)
    .map(([sym, meta]) => {
      const node = nodeStore.findByName(sym)[0];
      return {
        id: `runtime:${sym}`,
        symbol: node?.qualifiedName ?? node?.name ?? sym,
        file: node?.filePath ?? meta.file,
        line: node?.startLine ?? meta.line,
        kind: node?.kind ?? "runtime_symbol",
        language: node?.language ?? "runtime",
      };
    });

  // Fallback to static symbol suggestions so runtime mode remains searchable
  // before explicit runtime events are available.
  const staticSuggestions = nodeStore
    .getAll()
    .filter((n) => !["import", "export"].includes(n.kind))
    .filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        (n.qualifiedName ?? "").toLowerCase().includes(q),
    )
    .map((n) => {
      const exact = n.name.toLowerCase() === q || (n.qualifiedName ?? "").toLowerCase() === q;
      const prefix =
        n.name.toLowerCase().startsWith(q) || (n.qualifiedName ?? "").toLowerCase().startsWith(q);
      return { n, score: exact ? 0 : prefix ? 1 : 2 };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((n) => ({
      id: `static:${n.n.id}`,
      symbol: n.n.qualifiedName ?? n.n.name,
      file: n.n.filePath,
      line: n.n.startLine ?? 0,
      kind: n.n.kind,
      language: n.n.language ?? "",
    }));

  const seen = new Set<string>();
  const suggestions = [...runtimeSuggestions, ...staticSuggestions]
    .filter((s) => {
      const key = `${s.symbol}::${s.file}::${s.line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);

  return c.json({ data: { suggestions } });
});

traceRoutes.get("/trace/suggest", async (c) => {
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(30, Number(c.req.query("limit") ?? "10") || 10));

  if (!q) {
    return c.json({ data: { suggestions: [] } });
  }

  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);

  const suggestions = nodeStore
    .getAll()
    .filter((n) => !["import", "export"].includes(n.kind))
    .filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        (n.qualifiedName ?? "").toLowerCase().includes(q),
    )
    .map((n) => {
      const exact = n.name.toLowerCase() === q || (n.qualifiedName ?? "").toLowerCase() === q;
      const prefix =
        n.name.toLowerCase().startsWith(q) || (n.qualifiedName ?? "").toLowerCase().startsWith(q);
      return { n, score: exact ? 0 : prefix ? 1 : 2 };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((n) => ({
      id: n.n.id,
      symbol: n.n.qualifiedName ?? n.n.name,
      file: n.n.filePath,
      line: n.n.startLine ?? 0,
      kind: n.n.kind,
      language: n.n.language ?? "",
    }));

  return c.json({ data: { suggestions } });
});

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function equalsCi(a: string | null, b: string): boolean {
  if (!a) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function runtimeKey(
  nodeId?: string,
  symbol?: string,
  file?: string,
  line?: number,
): string | null {
  if (nodeId) return `node:${nodeId}`;
  const s = (symbol ?? "").trim();
  if (s) return `sym:${s}`;
  const f = (file ?? "").trim();
  if (f) return `loc:${f}:${line ?? 0}`;
  return null;
}

function resolveRuntimeNode(
  nodeStore: NodeStore,
  input: {
    nodeId?: string;
    symbol?: string;
    file?: string;
    line?: number;
  },
) {
  if (input.nodeId) {
    const byId = nodeStore.getById(input.nodeId);
    if (byId) return byId;
  }

  if (input.symbol) {
    const exact = nodeStore.findByName(input.symbol)[0];
    if (exact) return exact;

    const q = input.symbol.toLowerCase();
    return nodeStore
      .getAll()
      .find(
        (n) =>
          n.name.toLowerCase() === q ||
          (n.qualifiedName ?? "").toLowerCase() === q,
      );
  }

  if (input.file && input.line && input.line > 0) {
    return nodeStore.findByFileAndLine(input.file, input.line)[0];
  }

  return null;
}

function buildRuntimeTraceNode(
  key: string,
  depth: number,
  nodeStore: NodeStore,
  hintByKey: Map<string, { symbol?: string; file?: string; line?: number }>,
) {
  if (key.startsWith("node:")) {
    const nodeId = key.slice(5);
    const node = nodeStore.getById(nodeId);
    if (node) {
      return {
        id: key,
        name: node.qualifiedName ?? node.name,
        kind: node.kind,
        file: node.filePath,
        line: node.startLine ?? 0,
        endLine: node.endLine ?? undefined,
        column: 0,
        depth,
        language: node.language ?? "typescript",
      };
    }
  }

  const hint = hintByKey.get(key);
  const syntheticName =
    (hint?.symbol && hint.symbol.trim()) ||
    (key.startsWith("sym:") ? key.slice(4) : key);

  return {
    id: key,
    name: syntheticName,
    kind: "runtime_symbol",
    file: hint?.file ?? "",
    line: hint?.line ?? 0,
    column: 0,
    depth,
    language: "runtime",
  };
}

function isRuntimeTestKey(key: string, nodeStore: NodeStore): boolean {
  if (!key.startsWith("node:")) return false;
  const node = nodeStore.getById(key.slice(5));
  return Boolean(node?.isTest);
}

function ensureRuntimeTables(db: ReturnType<typeof openDatabase>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runtime_sessions (
      id TEXT PRIMARY KEY,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS runtime_edges (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      source_key TEXT NOT NULL,
      target_key TEXT NOT NULL,
      source_node_id TEXT,
      target_node_id TEXT,
      source_symbol TEXT,
      target_symbol TEXT,
      source_file TEXT,
      source_line INTEGER,
      target_file TEXT,
      target_line INTEGER,
      kind TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'bootstrapped',
      hit_count INTEGER NOT NULL DEFAULT 1,
      first_seen_ms INTEGER NOT NULL,
      last_seen_ms INTEGER NOT NULL,
      metadata_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_runtime_edges_session ON runtime_edges(session_id);
    CREATE INDEX IF NOT EXISTS idx_runtime_edges_source ON runtime_edges(source_key);
    CREATE INDEX IF NOT EXISTS idx_runtime_edges_target ON runtime_edges(target_key);
    CREATE INDEX IF NOT EXISTS idx_runtime_edges_last_seen ON runtime_edges(last_seen_ms);
  `);

  const cols = db
    .prepare("PRAGMA table_info(runtime_edges)")
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "source_type")) {
    db.exec("ALTER TABLE runtime_edges ADD COLUMN source_type TEXT NOT NULL DEFAULT 'bootstrapped'");
  }

  db.exec("CREATE INDEX IF NOT EXISTS idx_runtime_edges_source_type ON runtime_edges(source_type)");
}

function bootstrapRuntimeSessionFromStaticGraph(input: {
  db: ReturnType<typeof openDatabase>;
  nodeStore: NodeStore;
  edgeStore: EdgeStore;
  sessionId: string;
  symbol: string;
  nowMs: number;
}): number {
  const { db, nodeStore, edgeStore, sessionId, symbol, nowMs } = input;
  const maxDepth = 4;
  const maxEdges = 400;
  const allowedKinds = new Set(["calls", "data_flow", "imports", "uses", "defines", "contains"]);

  let seeds = nodeStore.findByName(symbol);
  if (seeds.length === 0) {
    const q = symbol.toLowerCase();
    seeds = nodeStore
      .getAll()
      .filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          (n.qualifiedName ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }

  if (seeds.length === 0) return 0;

  const upsertSession = db.prepare(
    `INSERT INTO runtime_sessions (id, created_at_ms, updated_at_ms)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET updated_at_ms = excluded.updated_at_ms`,
  );
  const upsertEdge = db.prepare(
    `INSERT INTO runtime_edges
      (id, session_id, source_key, target_key, source_node_id, target_node_id,
       source_symbol, target_symbol, source_file, source_line, target_file, target_line,
       kind, source_type, hit_count, first_seen_ms, last_seen_ms, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       hit_count = runtime_edges.hit_count + 1,
       source_type = CASE
         WHEN runtime_edges.source_type = 'observed' THEN 'observed'
         ELSE 'bootstrapped'
       END,
       last_seen_ms = excluded.last_seen_ms`,
  );

  const queue: Array<{ nodeId: string; depth: number }> = seeds.map((s) => ({
    nodeId: s.id,
    depth: 0,
  }));
  const visited = new Map<string, number>();
  let inserted = 0;

  upsertSession.run(sessionId, nowMs, nowMs);

  while (queue.length > 0 && inserted < maxEdges) {
    const cur = queue.shift()!;
    const prevDepth = visited.get(cur.nodeId);
    if (cur.depth > maxDepth) continue;
    if (prevDepth != null && prevDepth <= cur.depth) continue;
    visited.set(cur.nodeId, cur.depth);

    const source = nodeStore.getById(cur.nodeId);
    if (!source) continue;

    for (const edge of edgeStore.getOutgoing(cur.nodeId)) {
      if (!allowedKinds.has(edge.kind)) continue;
      const target = nodeStore.getById(edge.targetId);
      if (!target) continue;

      const sourceKey = `node:${source.id}`;
      const targetKey = `node:${target.id}`;
      const id = `${sessionId}:${edge.kind}:${sourceKey}->${targetKey}`;

      upsertEdge.run(
        id,
        sessionId,
        sourceKey,
        targetKey,
        source.id,
        target.id,
        source.qualifiedName ?? source.name,
        target.qualifiedName ?? target.name,
        source.filePath,
        source.startLine ?? 0,
        target.filePath,
        target.startLine ?? 0,
        edge.kind,
        "bootstrapped",
        1,
        nowMs,
        nowMs,
        JSON.stringify({
          ...(edge.metadata ?? {}),
          sourceType: "bootstrapped",
        }),
      );

      inserted++;
      if (cur.depth < maxDepth) {
        queue.push({ nodeId: target.id, depth: cur.depth + 1 });
      }
      if (inserted >= maxEdges) break;
    }
  }

  return inserted;
}
