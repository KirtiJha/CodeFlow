import { motion } from "framer-motion";
import { AlertTriangle, FileCode, Shield } from "lucide-react";
import type { TestGap } from "@/types/api";

interface UncoveredPathsProps {
  gaps: TestGap[];
  className?: string;
}

export function UncoveredPaths({ gaps, className = "" }: UncoveredPathsProps) {
  if (gaps.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-sm text-text-muted">
        <Shield className="h-8 w-8 text-accent-green/50" />
        <span>All code paths are covered</span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-text-muted">
          Uncovered Paths
        </span>
        <span className="text-accent-amber">
          {gaps.length} gap{gaps.length !== 1 ? "s" : ""}
        </span>
      </div>

      {gaps.map((gap, i) => (
        <motion.div
          key={`${gap.file}-${gap.symbol}-${i}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="rounded-lg border border-border-default bg-bg-surface p-3"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-amber" />
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-text-primary">
                  {gap.symbol}
                </span>
                {gap.risk && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      gap.risk === "high"
                        ? "bg-accent-red/10 text-accent-red"
                        : gap.risk === "medium"
                          ? "bg-accent-amber/10 text-accent-amber"
                          : "bg-accent-blue/10 text-accent-blue"
                    }`}
                  >
                    {gap.risk} risk
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
                <FileCode className="h-3 w-3" />
                <span className="truncate">{gap.file}</span>
                {gap.line && <span>:{gap.line}</span>}
              </div>
              {gap.reason && (
                <p className="mt-1.5 text-xs text-text-secondary">
                  {gap.reason}
                </p>
              )}
              {gap.suggestions && gap.suggestions.length > 0 && (
                <div className="mt-2 space-y-1">
                  {gap.suggestions.map((s, si) => (
                    <div key={si} className="text-xs text-accent-green/80">
                      → {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
