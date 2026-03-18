import { motion } from "framer-motion";
import { GitCommit, GitBranch } from "lucide-react";
import { formatRelativeTime } from "@/lib/formatters";
import type { BranchInfo, BranchConflict } from "@/types/branch";
import { getSeverityColor } from "@/lib/color-system";

interface BranchTimelineProps {
  branches: BranchInfo[];
  conflicts: BranchConflict[];
  className?: string;
}

export function BranchTimeline({
  branches,
  conflicts,
  className = "",
}: BranchTimelineProps) {
  const sortedBranches = [...branches].sort(
    (a, b) =>
      new Date(b.lastCommitDate).getTime() -
      new Date(a.lastCommitDate).getTime(),
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {sortedBranches.map((branch, i) => {
        const branchConflicts = conflicts.filter(
          (c) => c.branch1 === branch.name || c.branch2 === branch.name,
        );
        const maxSeverity = branchConflicts.reduce<string | null>((max, c) => {
          const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
          if (!max) return c.severity;
          return severityOrder[c.severity as keyof typeof severityOrder] >
            severityOrder[max as keyof typeof severityOrder]
            ? c.severity
            : max;
        }, null);

        return (
          <motion.div
            key={branch.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3"
          >
            {/* Timeline dot */}
            <div className="relative flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                  branch.current
                    ? "border-accent-blue bg-accent-blue/10"
                    : maxSeverity
                      ? `border-[${getSeverityColor(maxSeverity).text}] bg-[${getSeverityColor(maxSeverity).bg}]`
                      : "border-border-default bg-bg-elevated"
                }`}
              >
                {branch.current ? (
                  <GitBranch className="h-4 w-4 text-accent-blue" />
                ) : (
                  <GitCommit className="h-4 w-4 text-text-muted" />
                )}
              </div>
              {i < sortedBranches.length - 1 && (
                <div className="h-4 w-0.5 bg-border-default" />
              )}
            </div>

            {/* Branch info */}
            <div className="flex-1 rounded-lg border border-border-default bg-bg-surface p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">
                    {branch.name}
                  </span>
                  {branch.current && (
                    <span className="rounded bg-accent-blue/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-blue">
                      HEAD
                    </span>
                  )}
                </div>
                <span className="text-xs text-text-muted">
                  {formatRelativeTime(branch.lastCommitDate)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                <span>{branch.author}</span>
                {(branch.ahead > 0 || branch.behind > 0) && (
                  <span>
                    <span className="text-green-400">↑{branch.ahead}</span>{" "}
                    <span className="text-red-400">↓{branch.behind}</span>
                  </span>
                )}
                {branchConflicts.length > 0 && (
                  <span
                    className="font-medium"
                    style={{
                      color: maxSeverity
                        ? getSeverityColor(maxSeverity).text
                        : undefined,
                    }}
                  >
                    {branchConflicts.length} conflict
                    {branchConflicts.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
