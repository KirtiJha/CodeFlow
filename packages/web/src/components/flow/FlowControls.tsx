import {
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Minus,
  Plus,
} from "lucide-react";
import type { TraceQuery } from "@/types/trace";

interface FlowControlsProps {
  query: TraceQuery | null;
  onQueryChange: (query: Partial<TraceQuery>) => void;
  onTrace: () => void;
  isTracing: boolean;
  className?: string;
}

const directionOptions = [
  { value: "forward", label: "Forward" },
  { value: "backward", label: "Backward" },
  { value: "both", label: "Both" },
];

export function FlowControls({
  query,
  onQueryChange,
  onTrace,
  isTracing,
  className = "",
}: FlowControlsProps) {
  const depth = query?.depth ?? 3;

  return (
    <div
      className={`glass flex items-center gap-3 rounded-lg p-3 ${className}`}
    >
      {/* Direction */}
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

      {/* Depth */}
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

      {/* Include tests toggle */}
      <label className="flex items-center gap-2 text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={query?.includeTests ?? false}
          onChange={(e) => onQueryChange({ includeTests: e.target.checked })}
          className="rounded accent-accent-blue"
        />
        Include tests
      </label>

      {/* Trace button */}
      <button
        onClick={onTrace}
        disabled={isTracing || !query?.file}
        className="ml-auto rounded-lg bg-accent-blue px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-accent-blue/90 disabled:opacity-50"
      >
        {isTracing ? (
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Tracing…
          </span>
        ) : (
          "Trace"
        )}
      </button>
    </div>
  );
}
