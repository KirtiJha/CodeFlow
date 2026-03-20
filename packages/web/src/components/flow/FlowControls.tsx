import {
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Minus,
  Plus,
  RotateCw,
} from "lucide-react";
import type { TraceQuery } from "@/types/trace";

interface FlowControlsProps {
  query: TraceQuery | null;
  onQueryChange: (query: Partial<TraceQuery>) => void;
  onTrace: () => void;
  isTracing: boolean;
  canTrace?: boolean;
  className?: string;
  runtimeSessionId?: string;
  onRuntimeSessionIdChange?: (next: string) => void;
  runtimeSessions?: Array<{
    id: string;
    edgeCount: number;
    observedEdgeCount: number;
    bootstrappedEdgeCount: number;
  }>;
  onRuntimeSessionSelect?: (sessionId: string) => void;
  loadingRuntimeSessions?: boolean;
  runtimeSessionsError?: string | null;
  onRefreshRuntimeSessions?: () => void;
  onSeedRuntimeForSymbol?: () => void;
  canSeedRuntime?: boolean;
  seedingRuntime?: boolean;
}

const directionOptions = [
  { value: "forward", label: "Forward" },
  { value: "backward", label: "Backward" },
  { value: "both", label: "Both" },
];

const edgeKindOptions = [
  "calls",
  "data_flow",
  "imports",
  "uses",
  "contains",
  "defines",
];

export function FlowControls({
  query,
  onQueryChange,
  onTrace,
  isTracing,
  canTrace = true,
  className = "",
  runtimeSessionId,
  onRuntimeSessionIdChange,
  runtimeSessions = [],
  onRuntimeSessionSelect,
  loadingRuntimeSessions = false,
  runtimeSessionsError = null,
  onRefreshRuntimeSessions,
  onSeedRuntimeForSymbol,
  canSeedRuntime = false,
  seedingRuntime = false,
}: FlowControlsProps) {
  const depth = query?.depth ?? 3;
  const selectedKinds = query?.edgeKinds ?? [];

  return (
    <div className={`glass w-full rounded-lg p-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-muted">Mode</span>
          <div className="flex gap-0.5 rounded-lg bg-bg-elevated p-0.5">
            {(["static", "runtime"] as const).map((mode) => {
              const active = (query?.mode ?? "static") === mode;
              return (
                <button
                  key={mode}
                  onClick={() => onQueryChange({ mode })}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-accent-blue/15 text-accent-blue"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-muted">Direction</span>
          <div className="flex gap-0.5 rounded-lg bg-bg-elevated p-0.5">
            {directionOptions.map((opt) => {
              const Icon =
                opt.value === "forward"
                  ? ArrowRight
                  : opt.value === "backward"
                    ? ArrowLeft
                    : ArrowLeftRight;
              const isActive = (query?.direction ?? "forward") === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() =>
                    onQueryChange({
                      direction: opt.value as TraceQuery["direction"],
                    })
                  }
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-accent-blue/15 text-accent-blue"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-muted">Depth</span>
          <div className="flex items-center gap-1 rounded-lg bg-bg-elevated p-0.5">
            <button
              onClick={() => onQueryChange({ depth: Math.max(1, depth - 1) })}
              disabled={depth <= 1}
              className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-surface hover:text-text-secondary disabled:opacity-30"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 text-center text-xs font-semibold text-text-primary">
              {depth}
            </span>
            <button
              onClick={() => onQueryChange({ depth: Math.min(10, depth + 1) })}
              disabled={depth >= 10}
              className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-surface hover:text-text-secondary disabled:opacity-30"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={query?.includeTests ?? false}
            onChange={(e) => onQueryChange({ includeTests: e.target.checked })}
            className="rounded accent-accent-blue"
          />
          Include tests
        </label>

        <button
          onClick={onTrace}
          disabled={isTracing || !canTrace}
          className="ml-auto rounded-lg bg-accent-blue px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-accent-blue/90 disabled:opacity-50"
        >
          {isTracing ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Tracing...
            </span>
          ) : (
            "Trace"
          )}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-4 border-t border-border-default/60 pt-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Edge kinds
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg bg-bg-elevated p-1">
            <button
              onClick={() => onQueryChange({ edgeKinds: [] })}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                selectedKinds.length === 0
                  ? "bg-accent-blue/15 text-accent-blue"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              all
            </button>
            {edgeKindOptions.map((kind) => {
              const active = selectedKinds.length === 0 || selectedKinds.includes(kind);
              return (
                <button
                  key={kind}
                  onClick={() => {
                    const current = query?.edgeKinds ?? [];
                    const next = current.includes(kind)
                      ? current.filter((k) => k !== kind)
                      : [...current, kind];
                    onQueryChange({ edgeKinds: next });
                  }}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    active
                      ? "bg-accent-blue/15 text-accent-blue"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {kind}
                </button>
              );
            })}
          </div>
        </div>

        {(query?.mode ?? "static") === "runtime" && (
          <div className="w-full max-w-[560px] rounded-lg border border-border-default bg-bg-elevated/30 p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
                Runtime session
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={onSeedRuntimeForSymbol}
                  disabled={!canSeedRuntime || seedingRuntime}
                  className="inline-flex items-center gap-1 rounded border border-border-default px-1.5 py-0.5 text-[10px] text-text-secondary transition-colors hover:bg-bg-surface hover:text-text-primary disabled:opacity-50"
                  title="Generate sample observed runtime events for current symbol"
                >
                  {seedingRuntime ? "Seeding..." : "Seed sample events"}
                </button>
                <button
                  onClick={onRefreshRuntimeSessions}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:bg-bg-surface hover:text-text-primary"
                  title="Refresh sessions"
                >
                  <RotateCw className="h-3 w-3" />
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={runtimeSessionId?.trim() || "__default__"}
                onChange={(e) => {
                  const next = e.target.value === "__default__" ? "" : e.target.value;
                  onRuntimeSessionSelect?.(next);
                  onQueryChange({ sessionId: next.trim() || undefined });
                }}
                className="h-8 min-w-[170px] rounded-md border border-border-default bg-bg-surface px-2 text-[11px] text-text-primary focus:border-accent-blue focus:outline-none"
              >
                <option value="__default__">default</option>
                {runtimeSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} (obs {s.observedEdgeCount} | bt {s.bootstrappedEdgeCount})
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={runtimeSessionId ?? ""}
                onChange={(e) => {
                  onRuntimeSessionIdChange?.(e.target.value);
                  onQueryChange({ sessionId: e.target.value.trim() || undefined });
                }}
                placeholder="or type session id"
                className="h-8 min-w-[180px] flex-1 rounded-md border border-border-default bg-bg-surface px-2 text-[11px] text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
              />

              {loadingRuntimeSessions && (
                <span className="text-[10px] text-text-muted">loading sessions...</span>
              )}
            </div>

            <label className="mt-2 inline-flex items-center gap-2 text-[11px] text-text-secondary">
              <input
                type="checkbox"
                checked={query?.observedOnly ?? false}
                onChange={(e) => onQueryChange({ observedOnly: e.target.checked })}
                className="rounded accent-accent-blue"
              />
              Observed only (hide bootstrapped edges)
            </label>

            {runtimeSessionsError && (
              <div className="mt-2 rounded border border-amber-400/30 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-200">
                {runtimeSessionsError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
