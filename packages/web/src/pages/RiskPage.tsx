import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { RiskGauge } from "@/components/risk/RiskGauge";
import { RiskBreakdown } from "@/components/risk/RiskBreakdown";
import { RiskHistory } from "@/components/risk/RiskHistory";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { api } from "@/lib/api-client";
import { PAGE_VARIANTS } from "@/lib/constants";
import type { RiskScoreResponse } from "@/types/api";

export function RiskPage() {
  const [riskData, setRiskData] = useState<RiskScoreResponse | null>(null);
  const [hotspots, setHotspots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadRisk = useCallback(async () => {
    setIsLoading(true);
    try {
      const [scoreRes, hotspotsRes] = await Promise.all([
        api.riskScore("overall"),
        api.riskHotspots(),
      ]);
      setRiskData(scoreRes.data as RiskScoreResponse);
      setHotspots((hotspotsRes.data as { hotspots?: unknown[] })?.hotspots ?? []);
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRisk();
  }, [loadRisk]);

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="h-full overflow-auto p-6"
    >
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : riskData ? (
        <div className="space-y-8">
          {/* Top row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Risk gauge */}
            <div className="rounded-xl border border-border-default bg-bg-surface p-6">
              <RiskGauge score={riskData.score} label="Overall Risk" />
            </div>

            {/* Risk breakdown */}
            <div className="rounded-xl border border-border-default bg-bg-surface p-6 lg:col-span-2">
              <RiskBreakdown factors={riskData.factors ?? []} />
            </div>
          </div>

          {/* Risk history */}
          {riskData.history && riskData.history.length > 0 && (
            <div className="rounded-xl border border-border-default bg-bg-surface p-6">
              <RiskHistory entries={riskData.history} />
            </div>
          )}

          {/* Hotspots */}
          {hotspots.length > 0 && (
            <div className="rounded-xl border border-border-default bg-bg-surface p-6">
              <h3 className="mb-4 text-sm font-semibold text-text-primary">
                Risk Hotspots
              </h3>
              <div className="space-y-2">
                {hotspots.map((hotspot: any, i: number) => (
                  <motion.div
                    key={hotspot.file ?? i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between rounded-lg border border-border-default bg-bg-elevated/30 px-4 py-3"
                  >
                    <div className="flex-1 overflow-hidden">
                      <div className="truncate text-sm font-medium text-text-primary">
                        {hotspot.file}
                      </div>
                      {hotspot.reason && (
                        <div className="text-xs text-text-muted">
                          {hotspot.reason}
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-bg-elevated">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(hotspot.score ?? 0, 100)}%`,
                            backgroundColor:
                              hotspot.score >= 80
                                ? "#ef4444"
                                : hotspot.score >= 60
                                  ? "#f59e0b"
                                  : hotspot.score >= 40
                                    ? "#3b82f6"
                                    : "#10b981",
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-semibold text-text-primary">
                        {hotspot.score}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon="chart"
          title="Risk Assessment"
          description="Analyze a repository to compute composite risk scores based on complexity, coupling, test coverage, and change velocity."
        />
      )}
    </motion.div>
  );
}
