import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { X, FileCode, Search } from "lucide-react";
import { FlowDiagram } from "@/components/flow/FlowDiagram";
import { FlowControls } from "@/components/flow/FlowControls";
import { CodeViewer } from "@/components/code/CodeViewer";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useTraceStore } from "@/stores/trace-store";
import { api } from "@/lib/api-client";
import { PAGE_VARIANTS } from "@/lib/constants";
import type { TraceResult, TraceQuery } from "@/types/trace";

type TraceSuggestion = {
  id: string;
  symbol: string;
  file: string;
  line: number;
  kind: string;
};

type RuntimeSessionOption = {
  id: string;
  edgeCount: number;
  observedEdgeCount: number;
  bootstrappedEdgeCount: number;
  updatedAtMs: number;
};

export function TracePage() {
  const {
    result,
    query,
    selectedNode,
    isTracing,
    history,
    setResult,
    setQuery,
    selectNode,
    setTracing,
    addToHistory,
  } = useTraceStore();

  const [symbol, setSymbol] = useState(query?.symbol ?? "");
  const [suggestions, setSuggestions] = useState<TraceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [lastTracedSymbol, setLastTracedSymbol] = useState<string>("");

  const [runtimeSessionId, setRuntimeSessionId] = useState(query?.sessionId ?? "");
  const [runtimeSessions, setRuntimeSessions] = useState<RuntimeSessionOption[]>([]);
  const [loadingRuntimeSessions, setLoadingRuntimeSessions] = useState(false);
  const [runtimeSessionsError, setRuntimeSessionsError] = useState<string | null>(null);

  const [previewCode, setPreviewCode] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewTotalLines, setPreviewTotalLines] = useState<number | null>(null);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [runtimeSeedInfo, setRuntimeSeedInfo] = useState<string | null>(null);
  const [isSeedingRuntime, setIsSeedingRuntime] = useState(false);

  const autoTraceTimerRef = useRef<number | null>(null);

  const loadRuntimeSessions = useCallback(async () => {
    setLoadingRuntimeSessions(true);
    setRuntimeSessionsError(null);
    try {
      const res = await api.traceRuntimeSessions(30);
      const rows = res.data?.sessions ?? [];
      setRuntimeSessions(
        rows.map((s) => ({
          id: s.id,
          edgeCount: s.edge_count,
          observedEdgeCount: s.observed_edge_count ?? 0,
          bootstrappedEdgeCount: s.bootstrapped_edge_count ?? 0,
          updatedAtMs: s.updated_at_ms ?? 0,
        })),
      );
    } catch {
      setRuntimeSessions([]);
      setRuntimeSessionsError(
        "Runtime sessions API not available on the running backend. Restart the server to load the latest trace routes.",
      );
    } finally {
      setLoadingRuntimeSessions(false);
    }
  }, []);

  useEffect(() => {
    if ((query?.mode ?? "static") !== "runtime") return;
    void loadRuntimeSessions();
  }, [query?.mode, loadRuntimeSessions]);

  useEffect(() => {
    const trimmed = symbol.trim();
    if (!trimmed) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    const id = window.setTimeout(async () => {
      try {
        const mode = query?.mode ?? "static";
        const res =
          mode === "runtime"
            ? await api.traceRuntimeSuggest(trimmed, 8, query?.sessionId)
            : await api.traceSuggest(trimmed, 8);
        const items = res.data?.suggestions ?? [];
        setSuggestions(items);
        setShowSuggestions(isInputFocused && trimmed !== lastTracedSymbol && items.length > 0);
        setActiveSuggestionIndex(items.length > 0 ? 0 : -1);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    }, 180);

    return () => window.clearTimeout(id);
  }, [symbol, isInputFocused, lastTracedSymbol, query?.mode, query?.sessionId]);

  const handleQueryChange = useCallback(
    (partial: Partial<TraceQuery>) => {
      setQuery({
        file: "",
        symbol: symbol.trim(),
        depth: 5,
        direction: "forward",
        includeTests: false,
        observedOnly: false,
        edgeKinds: [],
        mode: "static",
        sessionId: runtimeSessionId.trim() || undefined,
        ...query,
        ...partial,
      });
    },
    [query, setQuery, symbol, runtimeSessionId],
  );

  const performTrace = useCallback(
    async (
      targetSymbol: string,
      opts: {
        direction: "forward" | "backward" | "both";
        depth: number;
        includeTests: boolean;
        addHistory?: boolean;
      },
    ) => {
      setTracing(true);
      setTraceError(null);

      try {
        const mode = query?.mode ?? "static";
        const sessionId = (query?.sessionId ?? runtimeSessionId).trim() || undefined;

        const res = await api.traceStaticOrRuntime({
          file: "",
          symbol: targetSymbol,
          from: targetSymbol,
          direction: opts.direction,
          depth: opts.depth,
          includeTests: opts.includeTests,
          observedOnly: query?.observedOnly ?? false,
          edgeKinds: query?.edgeKinds ?? [],
          mode,
          sessionId,
        });

        const next = (res.data as TraceResult) ?? null;
        setResult(next);
        selectNode(next?.nodes?.[0] ?? null);
        setLastTracedSymbol(targetSymbol);

        if (opts.addHistory !== false) {
          addToHistory({
            file: "",
            symbol: targetSymbol,
            depth: opts.depth,
            direction: opts.direction,
            includeTests: opts.includeTests,
            observedOnly: query?.observedOnly ?? false,
            edgeKinds: query?.edgeKinds ?? [],
            mode,
            sessionId,
          });
        }

        setPreviewCode("");
        setPreviewTotalLines(null);
        setShowSuggestions(false);
      } catch {
        setResult(null);
        selectNode(null);
        const mode = query?.mode ?? "static";
        setTraceError(
          mode === "runtime"
            ? "Runtime trace data not found. Ingest runtime events and use the correct session id."
            : "Trace failed. Verify symbol and trace settings.",
        );
      } finally {
        setTracing(false);
      }
    },
    [
      setResult,
      selectNode,
      setTracing,
      addToHistory,
      query?.edgeKinds,
      query?.observedOnly,
      query?.mode,
      query?.sessionId,
      runtimeSessionId,
    ],
  );

  const handleTrace = useCallback(
    async (explicitSymbol?: string) => {
      const targetSymbol = (explicitSymbol ?? symbol).trim();
      if (!targetSymbol) return;
      const direction = query?.direction ?? "forward";
      const depth = query?.depth ?? 5;
      const includeTests = query?.includeTests ?? false;
      await performTrace(targetSymbol, { direction, depth, includeTests, addHistory: true });
    },
    [symbol, query, performTrace],
  );

  const applySuggestion = useCallback(
    (s: TraceSuggestion) => {
      if (s.symbol === lastTracedSymbol && symbol.trim() === s.symbol) {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
        return;
      }
      setSymbol(s.symbol);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      void handleTrace(s.symbol);
    },
    [handleTrace, lastTracedSymbol, symbol],
  );

  useEffect(() => {
    if (!lastTracedSymbol || !query) return;
    if (isInputFocused) return;
    if (symbol.trim() !== lastTracedSymbol) return;

    const direction = query.direction ?? "forward";
    const depth = query.depth ?? 5;
    const includeTests = query.includeTests ?? false;

    if (autoTraceTimerRef.current) {
      clearTimeout(autoTraceTimerRef.current);
    }
    autoTraceTimerRef.current = window.setTimeout(() => {
      void performTrace(lastTracedSymbol, { direction, depth, includeTests, addHistory: false });
    }, 180);

    return () => {
      if (autoTraceTimerRef.current) {
        clearTimeout(autoTraceTimerRef.current);
      }
    };
  }, [
    query?.direction,
    query?.depth,
    query?.includeTests,
    query?.observedOnly,
    query?.edgeKinds,
    lastTracedSymbol,
    performTrace,
    isInputFocused,
    symbol,
  ]);

  useEffect(() => {
    if (!selectedNode?.file) {
      setPreviewCode("");
      setPreviewTotalLines(null);
      return;
    }

    let cancelled = false;
    setIsPreviewLoading(true);

    api
      .getSource(selectedNode.file)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.content) {
          setPreviewCode(res.data.content);
          setPreviewTotalLines(res.data.totalLines);
        } else {
          setPreviewCode(selectedNode.codeSnippet ?? "");
          setPreviewTotalLines(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPreviewCode(selectedNode.codeSnippet ?? "");
        setPreviewTotalLines(null);
      })
      .finally(() => {
        if (!cancelled) setIsPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedNode]);

  const previewHighlightRange = useMemo<[number, number] | undefined>(() => {
    if (!selectedNode?.line) return undefined;
    const startLine = selectedNode.line;
    // Use server-provided endLine if available
    if (selectedNode.endLine && selectedNode.endLine > startLine) {
      return [startLine, selectedNode.endLine];
    }
    // Otherwise compute the block end from the fetched source via brace matching
    if (previewCode) {
      const lines = previewCode.split("\n");
      const startIdx = startLine - 1;
      if (startIdx >= 0 && startIdx < lines.length) {
        let depth = 0;
        let foundOpen = false;
        for (let j = startIdx; j < lines.length; j++) {
          for (const ch of lines[j]!) {
            if (ch === "{") { depth++; foundOpen = true; }
            if (ch === "}") depth--;
          }
          if (foundOpen && depth <= 0) return [startLine, j + 1];
        }
      }
    }
    return [startLine, startLine];
  }, [selectedNode?.line, selectedNode?.endLine, previewCode]);

  const selectedTraceStats = useMemo(() => {
    if (!selectedNode || !result) {
      return { incoming: 0, outgoing: 0 };
    }
    let incoming = 0;
    let outgoing = 0;
    for (const e of result.edges) {
      if (e.source === selectedNode.id) outgoing++;
      if (e.target === selectedNode.id) incoming++;
    }
    return { incoming, outgoing };
  }, [selectedNode, result]);

  const selectedPath = useMemo(() => {
    if (!result || !selectedNode)
      return [] as Array<{ from: string; to: string; kind: string; direction: "forward" | "backward" }>;
    const roots = result.nodes.filter((n) => n.depth === 0).map((n) => n.id);
    if (roots.length === 0) return [];
    if (roots.includes(selectedNode.id)) return [];

    const adj = new Map<string, Array<{ to: string; kind: string; direction: "forward" | "backward" }>>();
    const pushAdj = (from: string, to: string, kind: string, direction: "forward" | "backward") => {
      const arr = adj.get(from) ?? [];
      arr.push({ to, kind, direction });
      adj.set(from, arr);
    };

    for (const e of result.edges) {
      pushAdj(e.source, e.target, e.kind, "forward");
      pushAdj(e.target, e.source, e.kind, "backward");
    }

    const prev = new Map<string, { from: string; kind: string; direction: "forward" | "backward" }>();
    const seen = new Set<string>(roots);
    const queue = [...roots];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur === selectedNode.id) break;
      for (const step of adj.get(cur) ?? []) {
        if (seen.has(step.to)) continue;
        seen.add(step.to);
        prev.set(step.to, { from: cur, kind: step.kind, direction: step.direction });
        queue.push(step.to);
      }
    }

    if (!prev.has(selectedNode.id)) return [];

    const hops: Array<{ from: string; to: string; kind: string; direction: "forward" | "backward" }> = [];
    let cur = selectedNode.id;
    while (prev.has(cur)) {
      const p = prev.get(cur)!;
      hops.push({ from: p.from, to: cur, kind: p.kind, direction: p.direction });
      cur = p.from;
    }
    hops.reverse();
    return hops;
  }, [result, selectedNode]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const node = result?.nodes.find((n) => n.id === nodeId) ?? null;
      selectNode(node);
    },
    [result, selectNode],
  );

  const seedRuntimeForCurrentSymbol = useCallback(async () => {
    const baseSymbol = symbol.trim();
    if (!baseSymbol) return;

    const sid = (query?.sessionId ?? runtimeSessionId).trim() || "default";
    const now = Date.now();
    const step1 = `${baseSymbol}::observed_step_1`;
    const step2 = `${baseSymbol}::observed_step_2`;

    setIsSeedingRuntime(true);
    setRuntimeSeedInfo(null);
    setTraceError(null);

    try {
      await api.ingestRuntimeTraceEvents({
        sessionId: sid,
        events: [
          {
            kind: "runtime_call",
            from: baseSymbol,
            to: step1,
            timestamp: now,
            metadata: { source: "ui_sample_seed", relation: "entry" },
          },
          {
            kind: "runtime_call",
            from: step1,
            to: step2,
            timestamp: now + 1,
            metadata: { source: "ui_sample_seed", relation: "mid" },
          },
          {
            kind: "runtime_data_flow",
            from: baseSymbol,
            to: step2,
            timestamp: now + 2,
            metadata: { source: "ui_sample_seed", relation: "data" },
          },
        ],
      });

      setRuntimeSeedInfo(
        `Added sample observed runtime events for '${baseSymbol}' in session '${sid}'.`,
      );
      await loadRuntimeSessions();
      await handleTrace(baseSymbol);
    } catch {
      setTraceError("Failed to seed sample runtime events. Try again.");
    } finally {
      setIsSeedingRuntime(false);
    }
  }, [symbol, query?.sessionId, runtimeSessionId, loadRuntimeSessions, handleTrace]);

  const selectedRuntimeSession = useMemo(() => {
    if ((query?.mode ?? "static") !== "runtime") return null;
    const sid = query?.sessionId ?? "default";
    return runtimeSessions.find((s) => s.id === sid) ?? null;
  }, [query?.mode, query?.sessionId, runtimeSessions]);

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex h-full flex-col"
    >
      <div className="border-b border-border-default px-4 py-3">
        <div className="rounded-lg border border-border-default bg-bg-base/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-medium uppercase tracking-wide text-text-muted">Symbol search</div>
            <div className="text-[11px] text-text-muted">Enter: trace, Up/Down: suggestions</div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                setActiveSuggestionIndex(0);
              }}
              onFocus={() => {
                setIsInputFocused(true);
                setShowSuggestions(suggestions.length > 0);
                setActiveSuggestionIndex(suggestions.length > 0 ? 0 : -1);
              }}
              onBlur={() => {
                setIsInputFocused(false);
                window.setTimeout(() => setShowSuggestions(false), 120);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowSuggestions(false);
                  setActiveSuggestionIndex(-1);
                  return;
                }

                if (showSuggestions && suggestions.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveSuggestionIndex((idx) => Math.min(idx + 1, suggestions.length - 1));
                    return;
                  }

                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveSuggestionIndex((idx) => Math.max(idx - 1, 0));
                    return;
                  }
                }

                if (e.key === "Enter") {
                  e.preventDefault();
                  if (showSuggestions && suggestions.length > 0 && activeSuggestionIndex >= 0) {
                    applySuggestion(suggestions[activeSuggestionIndex]!);
                  } else {
                    void handleTrace();
                  }
                }
              }}
              placeholder="Search symbol or file (e.g., processPayment, getRatingsCollection, src/lib/db/mongodb.ts)"
              className="w-full rounded-lg border border-border-default bg-bg-surface py-2 pl-10 pr-24 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
            />

            {symbol.trim().length > 0 && (
              <button
                onClick={() => {
                  setSymbol("");
                  setSuggestions([]);
                  setShowSuggestions(false);
                  setActiveSuggestionIndex(-1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[11px] text-text-muted hover:bg-bg-elevated hover:text-text-primary"
              >
                Clear
              </button>
            )}

            {showSuggestions && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-64 overflow-auto rounded-lg border border-border-default bg-bg-surface p-1 shadow-lg">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onMouseEnter={() => {
                      const idx = suggestions.findIndex((item) => item.id === s.id);
                      setActiveSuggestionIndex(idx);
                    }}
                    onMouseDown={() => applySuggestion(s)}
                    className={`flex w-full items-start justify-between rounded-md px-2 py-1.5 text-left ${
                      suggestions[activeSuggestionIndex]?.id === s.id
                        ? "bg-accent-blue/10"
                        : "hover:bg-bg-elevated"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-text-primary">{s.symbol}</div>
                      <div className="truncate text-[11px] text-text-muted">{s.file}:{s.line}</div>
                    </div>
                    <span className="ml-2 shrink-0 rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] uppercase text-text-muted">
                      {s.kind}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3">
          <FlowControls
            query={query}
            onQueryChange={handleQueryChange}
            runtimeSessionId={runtimeSessionId}
            onRuntimeSessionIdChange={setRuntimeSessionId}
            runtimeSessions={runtimeSessions}
            onRuntimeSessionSelect={setRuntimeSessionId}
            loadingRuntimeSessions={loadingRuntimeSessions}
            runtimeSessionsError={runtimeSessionsError}
            onRefreshRuntimeSessions={() => {
              void loadRuntimeSessions();
            }}
            onSeedRuntimeForSymbol={() => {
              void seedRuntimeForCurrentSymbol();
            }}
            canSeedRuntime={(query?.mode ?? "static") === "runtime" && symbol.trim().length > 0}
            seedingRuntime={isSeedingRuntime}
            onTrace={() => {
              void handleTrace();
            }}
            isTracing={isTracing}
            canTrace={symbol.trim().length > 0}
          />
        </div>
      </div>

      {history.length > 0 && (
        <div className="border-b border-border-default px-4 py-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-text-muted">Recent traces</div>
          <div className="flex flex-wrap gap-1.5">
            {history.slice(0, 8).map((h, idx) => (
              <button
                key={`${h.symbol}-${idx}`}
                onClick={() => {
                  const sym = h.symbol ?? "";
                  if (!sym) return;
                  if (
                    sym === lastTracedSymbol &&
                    (query?.mode ?? "static") === (h.mode ?? "static") &&
                    (query?.sessionId ?? "") === (h.sessionId ?? "") &&
                    query?.direction === h.direction &&
                    query?.depth === h.depth &&
                    query?.includeTests === h.includeTests &&
                    (query?.observedOnly ?? false) === (h.observedOnly ?? false) &&
                    JSON.stringify(query?.edgeKinds ?? []) === JSON.stringify(h.edgeKinds ?? [])
                  ) {
                    return;
                  }
                  setSymbol(sym);
                  setRuntimeSessionId(h.sessionId ?? "");
                  setQuery(h);
                  void performTrace(sym, {
                    direction: h.direction,
                    depth: h.depth,
                    includeTests: h.includeTests,
                    addHistory: false,
                  });
                }}
                className="rounded bg-bg-elevated px-2 py-1 text-[10px] text-text-secondary hover:text-text-primary"
                title={`${h.direction} depth:${h.depth}`}
              >
                {(h.mode ?? "static") === "runtime" ? "[rt] " : ""}
                {h.symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-b border-border-default px-4 py-2">
        <div className="rounded-md border border-cyan-400/25 bg-cyan-500/5 px-3 py-2 text-[11px] text-cyan-100">
          <div className="font-semibold">Trace semantics</div>
          <div className="mt-1 text-cyan-100/90">
            {(query?.mode ?? "static") === "runtime"
              ? "This view shows runtime-executed edges captured from instrumentation events."
              : "This view shows static code-graph traversal from the selected symbol, not runtime execution."}
            {(query?.mode ?? "static") === "runtime"
              ? " Use it to inspect observed call/data propagation for the selected session id (defaults to 'default' if empty)."
              : " Use it to inspect likely propagation paths across relationship edges."}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
            <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
              mode: {query?.mode ?? "static"}
            </span>
            {(query?.mode ?? "static") === "runtime" && (
              <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
                session: {query?.sessionId ?? "default"}
              </span>
            )}
            {(query?.mode ?? "static") === "runtime" && (
              <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
                source: {result?.runtimeSource ?? "unknown"}
              </span>
            )}
            {(query?.mode ?? "static") === "runtime" && (
              <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
                observed-only: {query?.observedOnly ? "yes" : "no"}
              </span>
            )}
            <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
              direction: {query?.direction ?? "forward"}
            </span>
            <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
              depth: {query?.depth ?? 5}
            </span>
            <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
              include tests: {query?.includeTests ?? false ? "yes" : "no"}
            </span>
            <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
              edges: {query?.edgeKinds && query.edgeKinds.length > 0 ? query.edgeKinds.join(", ") : "all"}
            </span>
            {(query?.mode ?? "static") === "runtime" && (
              <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
                observed edges: {result?.observedEdgeCount ?? 0}
              </span>
            )}
            {(query?.mode ?? "static") === "runtime" && (
              <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
                bootstrapped edges: {result?.bootstrappedEdgeCount ?? 0}
              </span>
            )}
          </div>
          {(query?.mode ?? "static") === "runtime" && selectedRuntimeSession && (
            <div className="mt-2 rounded border border-cyan-400/25 bg-cyan-500/5 px-2 py-1 text-[10px] text-cyan-100/90">
              Session summary: {selectedRuntimeSession.id} | total {selectedRuntimeSession.edgeCount} | observed {selectedRuntimeSession.observedEdgeCount} | bootstrapped {selectedRuntimeSession.bootstrappedEdgeCount}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {runtimeSeedInfo && (
          <div className="mx-4 mt-3 rounded-md border border-emerald-400/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200">
            {runtimeSeedInfo}
          </div>
        )}
        {traceError && (
          <div className="mx-4 mt-3 rounded-md border border-rose-400/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-200">
            {traceError}
          </div>
        )}
        {isTracing ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : result ? (
          <div className="h-full">
            {result.edges.length === 0 && (
              <div className="mx-4 mt-3 rounded-md border border-amber-400/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                No traversable edges were found from this symbol with the current settings.
                Try <span className="font-semibold">direction: both/backward</span>, increasing depth,
                or selecting a symbol that has call/data-flow links.
              </div>
            )}
            {result.fallbackUsed && (
              <div className="mx-4 mt-3 rounded-md border border-blue-400/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-200">
                Used fallback traversal: requested <span className="font-semibold">{result.requestedDirection}</span>,
                automatically expanded to <span className="font-semibold">both</span> because no edges were found.
              </div>
            )}
            <Allotment>
              <Allotment.Pane minSize={400}>
                <FlowDiagram trace={result} onNodeClick={handleNodeClick} />
              </Allotment.Pane>
              {selectedNode && (
                <Allotment.Pane minSize={300} preferredSize={400}>
                  <div className="flex h-full flex-col border-l border-border-default">
                    <div className="border-b border-border-default bg-bg-base/50 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-accent-blue" />
                        <div className="truncate text-sm font-semibold text-text-primary">{selectedNode.name}</div>
                        <span className="rounded-full border border-border-default bg-bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                          {selectedNode.kind}
                        </span>
                        <button
                          onClick={() => selectNode(null)}
                          className="ml-auto shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-bg-surface hover:text-text-primary"
                          title="Close panel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                        <FileCode className="h-3 w-3" />
                        <span className="truncate">
                          {selectedNode.file}:{selectedNode.line}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                        <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
                          kind: {selectedNode.kind}
                        </span>
                        <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
                          depth: {selectedNode.depth}
                        </span>
                        <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
                          out: {selectedTraceStats.outgoing}
                        </span>
                        <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
                          in: {selectedTraceStats.incoming}
                        </span>
                        {previewTotalLines != null && (
                          <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
                            lines: {previewTotalLines}
                          </span>
                        )}
                        {query?.edgeKinds && query.edgeKinds.length > 0 && (
                          <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-text-muted">
                            edges: {query.edgeKinds.join(", ")}
                          </span>
                        )}
                      </div>
                      {selectedPath.length > 0 && (
                        <div className="mt-2 rounded border border-border-default bg-bg-elevated/30 p-2">
                          <div className="mb-1 text-[10px] uppercase tracking-wide text-text-muted">Path to selected node</div>
                          <div className="max-h-24 space-y-1 overflow-auto text-[11px] text-text-secondary">
                            {selectedPath.map((h, i) => (
                              <div key={`${h.from}-${h.to}-${i}`} className="truncate">
                                {i + 1}. {h.kind} ({h.direction})
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 overflow-auto">
                      {isPreviewLoading ? (
                        <div className="p-4">
                          <LoadingSpinner size="sm" />
                        </div>
                      ) : (
                        <CodeViewer
                          code={previewCode || selectedNode.codeSnippet || ""}
                          language={selectedNode.language ?? "typescript"}
                          highlightRange={previewHighlightRange}
                          startLine={1}
                          maxHeight="100%"
                        />
                      )}
                    </div>
                  </div>
                </Allotment.Pane>
              )}
            </Allotment>
          </div>
        ) : (
          <EmptyState
            icon="search"
            title="Trace Data Flows"
            description="Enter a symbol name to trace how data flows through your codebase - across function calls, modules, and transformations."
          />
        )}
      </div>
    </motion.div>
  );
}
