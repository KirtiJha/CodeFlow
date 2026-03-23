import { motion } from "framer-motion";
import type { RiskFactor } from "@/types/api";

/* ── Factor display names & icons ────────────────────────────── */
const FACTOR_META: Record<string, { label: string; icon: string }> = {
  complexity: { label: "Code Complexity", icon: "🧩" },
  testCoverage: { label: "Test Coverage", icon: "🧪" },
  dataSensitivity: { label: "Data Sensitivity", icon: "🔐" },
  blastRadius: { label: "Blast Radius", icon: "💥" },
  changeVelocity: { label: "Change Velocity", icon: "⚡" },
  errorHandling: { label: "Error Handling", icon: "🛡️" },
};

function factorColor(score: number): string {
  if (score >= 8) return "#ef4444";
  if (score >= 6) return "#f97316";
  if (score >= 4) return "#f59e0b";
  if (score >= 2) return "#3b82f6";
  return "#10b981";
}

interface RiskBreakdownProps {
  factors: RiskFactor[];
  className?: string;
}

export function RiskBreakdown({ factors, className = "" }: RiskBreakdownProps) {
  const sorted = [...factors].sort((a, b) => b.score * b.weight - a.score * a.weight);

  if (factors.length === 0) {
    return (
      <div className={`${className}`}>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">
          Risk Factors
        </h4>
        <div className="py-6 text-center text-xs text-text-muted">
          No risk factor data available
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        Risk Factors
      </h4>
      {sorted.map((factor, i) => {
        const meta = FACTOR_META[factor.name] ?? { label: factor.name, icon: "•" };
        const width = (factor.score / 10) * 100;
        const color = factorColor(factor.score);
        const impact = Math.round(factor.score * factor.weight * 10);

        return (
          <motion.div
            key={factor.name}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs">{meta.icon}</span>
                <span className="text-sm text-text-primary">{meta.label}</span>
                <span className="text-[9px] text-text-muted">
                  ({Math.round(factor.weight * 100)}% weight)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted">
                  impact: {impact}
                </span>
                <span className="text-xs font-semibold" style={{ color }}>
                  {factor.score.toFixed(1)}/10
                </span>
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.06 }}
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>

            {factor.description && (
              <p className="text-[11px] text-text-muted">
                {factor.description}
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
