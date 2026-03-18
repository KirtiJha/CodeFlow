import { motion } from "framer-motion";
import { formatPercent } from "@/lib/formatters";

interface TestCoverageProps {
  covered: number;
  total: number;
  byFile?: Array<{ file: string; covered: number; total: number }>;
  className?: string;
}

export function TestCoverage({
  covered,
  total,
  byFile = [],
  className = "",
}: TestCoverageProps) {
  const percentage = total > 0 ? (covered / total) * 100 : 0;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = (pct: number) => {
    if (pct >= 80) return { stroke: "#10b981", text: "text-accent-green" };
    if (pct >= 60) return { stroke: "#f59e0b", text: "text-accent-amber" };
    return { stroke: "#ef4444", text: "text-accent-red" };
  };

  const color = getColor(percentage);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Radial gauge */}
      <div className="flex items-center justify-center py-4">
        <div className="relative">
          <svg width="120" height="120" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#1a1a2e"
              strokeWidth="8"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={color.stroke}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${color.text}`}>
              {formatPercent(percentage)}
            </span>
            <span className="text-[10px] text-text-muted">Coverage</span>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex justify-center gap-6 text-xs">
        <div className="text-center">
          <div className="font-semibold text-text-primary">{covered}</div>
          <div className="text-text-muted">Covered</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-text-primary">
            {total - covered}
          </div>
          <div className="text-text-muted">Uncovered</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-text-primary">{total}</div>
          <div className="text-text-muted">Total</div>
        </div>
      </div>

      {/* Per-file breakdown */}
      {byFile.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            By File
          </h4>
          {byFile.map((f) => {
            const pct = f.total > 0 ? (f.covered / f.total) * 100 : 0;
            const fc = getColor(pct);
            return (
              <div key={f.file} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate text-text-secondary">{f.file}</span>
                  <span className={fc.text}>{formatPercent(pct)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: fc.stroke }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
