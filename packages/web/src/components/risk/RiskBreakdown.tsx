import { motion } from "framer-motion";
import type { RiskFactor } from "@/types/api";
import { getRiskColor } from "@/lib/color-system";

interface RiskBreakdownProps {
  factors: RiskFactor[];
  className?: string;
}

export function RiskBreakdown({ factors, className = "" }: RiskBreakdownProps) {
  const sorted = [...factors].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...factors.map((f) => f.score), 1);

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        Risk Factors
      </h4>
      {sorted.map((factor, i) => {
        const width = (factor.score / maxScore) * 100;
        const color = getRiskColor(factor.score);

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
                <span className="text-sm text-text-primary">{factor.name}</span>
                {factor.trend && (
                  <span
                    className={`text-[10px] ${
                      factor.trend === "up"
                        ? "text-accent-red"
                        : factor.trend === "down"
                          ? "text-accent-green"
                          : "text-text-muted"
                    }`}
                  >
                    {factor.trend === "up"
                      ? "↑"
                      : factor.trend === "down"
                        ? "↓"
                        : "→"}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold" style={{ color }}>
                {factor.score}
              </span>
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
