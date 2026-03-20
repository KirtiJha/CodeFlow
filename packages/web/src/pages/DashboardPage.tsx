import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileCode,
  GitBranch,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Network,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MetricCard } from "@/components/shared/Card";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { useAppStore } from "@/stores/app-store";
import { useAnalysisStore } from "@/stores/analysis-store";
import { useBranchStore } from "@/stores/branch-store";
import { useSecurityStore } from "@/stores/security-store";
import { useSSE } from "@/hooks/useSSE";
import { api } from "@/lib/api-client";
import { PAGE_VARIANTS, ROUTES, PHASE_NAMES } from "@/lib/constants";
import {
  formatNumber,
  formatDuration,
  formatRelativeTime,
} from "@/lib/formatters";

export function DashboardPage() {
  const navigate = useNavigate();
  const { stats, progress, isRunning } = useAnalysisStore();
  const { conflicts } = useBranchStore();
  const { score } = useSecurityStore();

  // Subscribe to SSE events for live updates
  useSSE("analysis-progress", (data) => {
    useAnalysisStore.getState().updateProgress(data as unknown as import("@/types/analysis").PipelineProgress);
  });

  useSSE("analysis-complete", (data) => {
    useAnalysisStore.getState().setStats((data as { stats: import("@/types/analysis").AnalysisStats }).stats);
  });

  // Load initial data (check status on mount)
  useEffect(() => {
    api
      .getStatus()
      .then((status) => {
        if (status.data?.stats && status.data.indexed) {
          const s = status.data.stats;
          useAnalysisStore.getState().setStats({
            totalFiles: s.files ?? 0,
            totalNodes: s.nodes ?? 0,
            totalEdges: s.edges ?? 0,
            totalSymbols: (s.functions ?? 0) + (s.classes ?? 0),
            totalFunctions: s.functions ?? 0,
            totalClasses: s.classes ?? 0,
            totalCommunities: s.communities ?? 0,
            functions: s.functions ?? 0,
            classes: s.classes ?? 0,
            communities: s.communities ?? 0,
            callEdges: s.edges ?? 0,
          } as import("@/types/analysis").AnalysisStats);
          useAppStore.getState().setAnalyzed(true);
        }
      })
      .catch(() => {});
  }, []);

  const criticalConflicts = conflicts.filter(
    (c) => c.severity === "critical",
  ).length;
  const highConflicts = conflicts.filter((c) => c.severity === "high").length;

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6 p-6"
    >
      {/* Analysis progress (if running) */}
      {isRunning && progress && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-xl border border-border-default bg-bg-surface p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 animate-pulse text-accent-blue" />
              <span className="text-sm font-medium text-text-primary">
                Analysis in Progress
              </span>
            </div>
            <span className="text-xs text-text-muted">
              {PHASE_NAMES[progress.phase] ?? progress.phase}
            </span>
          </div>
          <ProgressBar value={progress.percent} size="md" showPercent />
          {progress.message && (
            <p className="mt-2 text-xs text-text-muted">{progress.message}</p>
          )}
        </motion.div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Symbols"
          value={stats ? formatNumber(stats.totalSymbols ?? 0) : "—"}
          change={stats?.symbolChange}
          icon={<Network className="h-4 w-4" />}
          color="blue"
          onClick={() => navigate(ROUTES.graph)}
        />
        <MetricCard
          title="Files Analyzed"
          value={stats ? formatNumber(stats.totalFiles) : "—"}
          icon={<FileCode className="h-4 w-4" />}
          color="purple"
        />
        <MetricCard
          title="Branch Conflicts"
          value={String(conflicts.length)}
          change={criticalConflicts > 0 ? criticalConflicts : undefined}
          icon={<GitBranch className="h-4 w-4" />}
          color={criticalConflicts > 0 ? "red" : "green"}
          onClick={() => navigate(ROUTES.branches)}
        />
        <MetricCard
          title="Security Score"
          value={score ? `${score.overall}/100` : "—"}
          icon={<Shield className="h-4 w-4" />}
          color={
            score
              ? score.overall >= 80
                ? "green"
                : score.overall >= 60
                  ? "amber"
                  : "red"
              : "blue"
          }
          onClick={() => navigate(ROUTES.security)}
        />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent analysis */}
        <div className="rounded-xl border border-border-default bg-bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">
            Analysis Summary
          </h3>
          {stats ? (
            <div className="space-y-3">
              <SummaryRow
                label="Languages"
                value={stats.languages?.join(", ") ?? "—"}
              />
              <SummaryRow
                label="Functions"
                value={formatNumber(stats.functions ?? 0)}
              />
              <SummaryRow label="Classes" value={formatNumber(stats.classes ?? 0)} />
              <SummaryRow
                label="Call Edges"
                value={formatNumber(stats.callEdges ?? 0)}
              />
              <SummaryRow
                label="Data-Flow Edges"
                value={formatNumber(stats.dataFlowEdges ?? 0)}
              />
              <SummaryRow
                label="Communities"
                value={formatNumber(stats.communities ?? 0)}
              />
              <SummaryRow
                label="Analysis Duration"
                value={stats.duration ? formatDuration(stats.duration) : "—"}
              />
              <SummaryRow
                label="Last Analyzed"
                value={
                  stats.lastAnalyzed
                    ? formatRelativeTime(stats.lastAnalyzed)
                    : "—"
                }
              />
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              No analysis data. Analyze a repository to get started.
            </p>
          )}
        </div>

        {/* Quick actions / alerts */}
        <div className="rounded-xl border border-border-default bg-bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">
            Alerts & Insights
          </h3>
          <div className="space-y-2">
            {criticalConflicts > 0 && (
              <AlertRow
                severity="critical"
                message={`${criticalConflicts} critical branch conflict${criticalConflicts !== 1 ? "s" : ""} detected`}
                onClick={() => navigate(ROUTES.branches)}
              />
            )}
            {highConflicts > 0 && (
              <AlertRow
                severity="high"
                message={`${highConflicts} high-severity conflict${highConflicts !== 1 ? "s" : ""}`}
                onClick={() => navigate(ROUTES.branches)}
              />
            )}
            {score && score.criticalCount > 0 && (
              <AlertRow
                severity="critical"
                message={`${score.criticalCount} critical taint flow${score.criticalCount !== 1 ? "s" : ""}`}
                onClick={() => navigate(ROUTES.security)}
              />
            )}
            {criticalConflicts === 0 &&
              highConflicts === 0 &&
              (!score || score.criticalCount === 0) && (
                <div className="flex items-center gap-2 rounded-lg bg-accent-green/5 p-3 text-sm text-accent-green">
                  <CheckCircle2 className="h-4 w-4" />
                  All clear — no critical issues detected!
                </div>
              )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border-default/50 pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xs font-medium text-text-primary">{value}</span>
    </div>
  );
}

function AlertRow({
  severity,
  message,
  onClick,
}: {
  severity: string;
  message: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm transition-all hover:brightness-110 ${
        severity === "critical"
          ? "bg-accent-red/5 text-accent-red"
          : "bg-accent-amber/5 text-accent-amber"
      }`}
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      {message}
    </button>
  );
}
