import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { TaintFlowDiagram } from "@/components/security/TaintFlowDiagram";
import { VulnerabilityCard } from "@/components/security/VulnerabilityCard";
import { SecurityScore } from "@/components/security/SecurityScore";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Select } from "@/components/shared/Select";
import { useSecurityStore } from "@/stores/security-store";
import { api } from "@/lib/api-client";
import { PAGE_VARIANTS } from "@/lib/constants";

export function SecurityPage() {
  const {
    report,
    score,
    selectedFlow,
    filterSeverity,
    filterCategory,
    setReport,
    setScore,
    selectFlow,
    setFilterSeverity,
    setFilterCategory,
  } = useSecurityStore();
  const [isLoading, setIsLoading] = useState(false);

  const scan = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reportRes, scoreRes] = await Promise.all([
        api.securityReport(),
        api.securityScan(),
      ]);
      setReport(reportRes.data as import("@/types/security").SecurityReport);
      setScore(scoreRes.data as import("@/types/security").SecurityScore);
    } catch {
      // handled by api-client
    } finally {
      setIsLoading(false);
    }
  }, [setReport, setScore]);

  useEffect(() => {
    if (!report) scan();
  }, []);

  const flows = report?.flows ?? [];
  const filteredFlows = flows.filter((f) => {
    if (filterSeverity && f.severity !== filterSeverity) return false;
    if (filterCategory && f.category !== filterCategory) return false;
    return true;
  });

  const categories = [...new Set(flows.map((f) => f.category))];

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex h-full flex-col"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <div className="flex items-center gap-3">
          <Select
            value={filterSeverity ?? "all"}
            onValueChange={(v) => setFilterSeverity(v === "all" ? null : v)}
            options={[
              { value: "all", label: "All Severities" },
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
            placeholder="Severity"
          />
          <Select
            value={filterCategory ?? "all"}
            onValueChange={(v) => setFilterCategory(v === "all" ? null : v)}
            options={[
              { value: "all", label: "All Categories" },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
            placeholder="Category"
          />
        </div>
        <button
          onClick={scan}
          disabled={isLoading}
          className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white transition-all hover:bg-accent-blue/90 disabled:opacity-50"
        >
          {isLoading ? "Scanning..." : "Re-scan"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : report ? (
          <Allotment>
            {/* Left: flow diagram */}
            <Allotment.Pane minSize={400}>
              <TaintFlowDiagram
                flows={filteredFlows}
                selectedFlowId={selectedFlow?.id}
                onFlowSelect={selectFlow}
              />
            </Allotment.Pane>

            {/* Right: list + score */}
            <Allotment.Pane minSize={280} preferredSize={340}>
              <div className="flex h-full flex-col border-l border-border-default">
                {/* Security score */}
                {score && (
                  <div className="border-b border-border-default p-4">
                    <SecurityScore score={score} />
                  </div>
                )}

                {/* Vulnerability list */}
                <div className="flex-1 overflow-auto p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Taint Flows ({filteredFlows.length})
                  </h3>
                  <div className="space-y-2">
                    {filteredFlows.map((flow) => (
                      <VulnerabilityCard
                        key={flow.id}
                        flow={flow}
                        onClick={() => selectFlow(flow)}
                        selected={selectedFlow?.id === flow.id}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Allotment.Pane>
          </Allotment>
        ) : (
          <EmptyState
            icon="shield"
            title="Security Analysis"
            description="Run a security scan to detect taint flows and find potential vulnerabilities."
            action={
              <button
                onClick={scan}
                className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white"
              >
                Run Security Scan
              </button>
            }
          />
        )}
      </div>
    </motion.div>
  );
}
