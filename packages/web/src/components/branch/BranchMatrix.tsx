import { useMemo } from "react";
import { motion } from "framer-motion";
import { Tooltip } from "@/components/shared/Tooltip";
import { getSeverityColor } from "@/lib/color-system";
import type { BranchMatrix as BranchMatrixType } from "@/types/branch";

interface BranchMatrixProps {
  matrix: BranchMatrixType;
  onCellClick?: (branch1: string, branch2: string) => void;
  className?: string;
}

export function BranchMatrix({
  matrix,
  onCellClick,
  className = "",
}: BranchMatrixProps) {
  const cellSize = Math.min(40, Math.max(24, 400 / matrix.branches.length));

  const conflictMap = useMemo(() => {
    const map = new Map<string, { severity: string; count: number }>();
    for (const c of matrix.conflicts) {
      map.set(`${c.row}-${c.col}`, { severity: c.severity, count: c.count });
    }
    return map;
  }, [matrix]);

  return (
    <div className={`overflow-auto ${className}`}>
      <div className="inline-block">
        {/* Header row */}
        <div className="flex">
          <div style={{ width: cellSize * 3 }} />
          {matrix.branches.map((branch, i) => (
            <div
              key={i}
              style={{ width: cellSize, height: cellSize * 2 }}
              className="flex items-end justify-center overflow-hidden"
            >
              <span
                className="origin-bottom-left -rotate-45 truncate whitespace-nowrap text-[10px] text-text-muted"
                style={{ maxWidth: cellSize * 2 }}
              >
                {branch}
              </span>
            </div>
          ))}
        </div>

        {/* Matrix rows */}
        {matrix.branches.map((branch, row) => (
          <div key={row} className="flex">
            <div
              style={{ width: cellSize * 3, height: cellSize }}
              className="flex items-center justify-end pr-2"
            >
              <span className="truncate text-[10px] text-text-muted">
                {branch}
              </span>
            </div>
            {matrix.branches.map((_, col) => {
              const key = `${row}-${col}`;
              const cell = conflictMap.get(key);
              const isDiagonal = row === col;

              return (
                <Tooltip
                  key={col}
                  content={
                    isDiagonal
                      ? branch
                      : cell
                        ? `${cell.count} ${cell.severity} conflicts`
                        : "No conflicts"
                  }
                >
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    style={{ width: cellSize, height: cellSize }}
                    onClick={() => {
                      if (!isDiagonal && cell) {
                        onCellClick?.(
                          matrix.branches[row],
                          matrix.branches[col],
                        );
                      }
                    }}
                    className={`m-0.5 rounded-sm transition-all ${
                      isDiagonal
                        ? "bg-bg-elevated/50"
                        : cell
                          ? "cursor-pointer hover:ring-1 hover:ring-border-focus"
                          : "bg-bg-surface/30"
                    }`}
                  >
                    {!isDiagonal && cell && (
                      <div
                        className="flex h-full w-full items-center justify-center rounded-sm text-[9px] font-bold"
                        style={{
                          backgroundColor: getSeverityColor(cell.severity).bg,
                          color: getSeverityColor(cell.severity).text,
                        }}
                      >
                        {cell.count}
                      </div>
                    )}
                  </motion.button>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
