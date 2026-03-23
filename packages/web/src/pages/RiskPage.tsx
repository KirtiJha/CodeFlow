import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Shield,
  FileCode,
  Activity,
  ChevronDown,
  ChevronRight,
  Zap,
  TrendingUp,
} from "lucide-react";
import { RiskGauge } from "@/components/risk/RiskGauge";
import { RiskBreakdown } from "@/components/risk/RiskBreakdown";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { api } from "@/lib/api-client";
import { PAGE_VARIANTS } from "@/lib/constants";
import type { RiskScoreResponse, RiskHotspot, RiskFactor, FileRisk } from "@/types/api";

/* ── Color helpers ────────────────────────────────────────────── */

function riskColor(score: number): string {
  if (score >= 75) return "#ef4444";
  if (score >= 50) return "#f97316";
  if (score >= 25) return "#f59e0b";
  return "#10b981";
}

function levelColor(level: string): string {
  switch (level) {
    case "critical": return "#ef4444";
    case "high": return "#f97316";
    case "medium": return "#f59e0b";
    case "low": return "#10b981";
    default: return "#6b7280";
  }
}

function levelBg(level: string): string {
  switch (level) {
    case "critical": return "rgba(239,68,68,0.08)";
    case "high": return "rgba(249,115,22,0.08)";
    case "medium": return "rgba(245,158,11,0.08)";
    case "low": return "rgba(16,185,129,0.08)";
    default: return "rgba(107,114,128,0.08)";
  }
}

/* ── Factor display names ─────────────────────────────────────── */
const FACTOR_LABELS: Record<string, string> = {
  complexity: "Complexity",
  testCoverage: "Test Coverage",
  dataSensitivity: "Data Sensitivity",
  blastRadius: "Blast Radius",
  changeVelocity: "Change Velocity",
  errorHandling: "Error Handling",
};

/* ════════════════════════════════════════════════════════════════
   Main Page
   ════════════════════════════════════════════════════════════════ */

export function RiskPage() {
  const [riskData, setRiskData] = useState<RiskScoreResponse | null>(null);
  const [hotspots, setHotspots] = useState<RiskHotspot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedHotspot, setExpandedHotspot] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const loadRisk = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [scoreRes, hotspotsRes] = await Promise.all([
        api.riskScore("overall"),
        api.riskHotspots(30),
      ]);
      setRiskData(scoreRes as unknown as RiskScoreResponse);
      setHotspots((hotspotsRes as unknown as { hotspots: RiskHotspot[] }).hotspots ?? []);
    } catch (err) {
      setError("Failed to load risk data. Ensure a repository is indexed.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRisk();
  }, [loadRisk]);

  /* Derived stats */
  const stats = useMemo(() => {
    if (!riskData?.stats) return null;
    const { totalFunctions, byLevel } = riskData.stats;
    return {
      totalFunctions,
      critical: byLevel.critical ?? 0,
      high: byLevel.high ?? 0,
      medium: byLevel.medium ?? 0,
      low: byLevel.low ?? 0,
    };
  }, [riskData]);

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
      ) : error ? (
        <EmptyState
          icon="chart"
          title="Risk Assessment"
          description={error}
        />
      ) : riskData ? (
        <div className="mx-auto max-w-7xl space-y-6">
          {/* ── Page header ──────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Shield className="h-5 w-5 text-accent-blue" />
                Risk Assessment
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                Composite risk analysis across {stats?.totalFunctions ?? 0} functions
              </p>
            </div>
            <button
              onClick={loadRisk}
              className="rounded-lg border border-border-default bg-bg-surface px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-elevated transition"
            >
              Refresh
            </button>
          </div>

          {/* ── Top row: Gauge + Stats + Factors ─────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Risk Gauge */}
            <div className="lg:col-span-3 rounded-xl border border-border-default bg-bg-surface p-5 flex flex-col items-center justify-center">
              <RiskGauge score={riskData.score} label="Overall Risk" />
              <div className="mt-2 text-center">
                <span
                  className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase"
                  style={{
                    color: levelColor(riskData.level),
                    background: levelBg(riskData.level),
                  }}
                >
                  {riskData.level}
                </span>
              </div>
            </div>

            {/* Distribution cards */}
            <div className="lg:col-span-3 grid grid-cols-2 gap-3">
              <StatCard
                label="Critical"
                value={stats?.critical ?? 0}
                total={stats?.totalFunctions ?? 1}
                color="#ef4444"
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
              />
              <StatCard
                label="High"
                value={stats?.high ?? 0}
                total={stats?.totalFunctions ?? 1}
                color="#f97316"
                icon={<TrendingUp className="h-3.5 w-3.5" />}
              />
              <StatCard
                label="Medium"
                value={stats?.medium ?? 0}
                total={stats?.totalFunctions ?? 1}
                color="#f59e0b"
                icon={<Activity className="h-3.5 w-3.5" />}
              />
              <StatCard
                label="Low"
                value={stats?.low ?? 0}
                total={stats?.totalFunctions ?? 1}
                color="#10b981"
                icon={<Shield className="h-3.5 w-3.5" />}
              />
            </div>

            {/* Risk Factors Breakdown */}
            <div className="lg:col-span-6 rounded-xl border border-border-default bg-bg-surface p-5">
              <RiskBreakdown factors={riskData.factors ?? []} />
            </div>
          </div>

          {/* ── File Risk Heatmap ────────────────────────────── */}
          {riskData.fileRisks && riskData.fileRisks.length > 0 && (
            <div className="rounded-xl border border-border-default bg-bg-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
                  <FileCode className="h-3.5 w-3.5" />
                  File Risk Heatmap
                </h3>
                <span className="text-[10px] text-text-muted">
                  {riskData.fileRisks.length} files analyzed
                </span>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 mb-3 text-[10px] text-text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-8 h-2 rounded-full bg-accent-amber" />
                  Avg risk
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-8 h-2 rounded-full bg-accent-amber opacity-30" />
                  Max risk
                </span>
                <span>Click a row to see its riskiest functions</span>
              </div>
              <div className="grid gap-1.5">
                {riskData.fileRisks.map((fr, i) => (
                  <FileRiskBar
                    key={fr.file}
                    fileRisk={fr}
                    rank={i + 1}
                    hotspots={hotspots.filter((h) => h.file === fr.file)}
                    expanded={expandedFile === fr.file}
                    onToggle={() => setExpandedFile(expandedFile === fr.file ? null : fr.file)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Hotspots ─────────────────────────────────────── */}
          {hotspots.length > 0 && (
            <div className="rounded-xl border border-border-default bg-bg-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5" />
                  Risk Hotspots — Top {hotspots.length} Functions
                </h3>
              </div>
              <div className="space-y-1.5">
                {hotspots.map((hotspot, i) => (
                  <HotspotRow
                    key={`${hotspot.file}-${hotspot.name}-${i}`}
                    hotspot={hotspot}
                    rank={i + 1}
                    expanded={expandedHotspot === `${hotspot.file}:${hotspot.name}`}
                    onToggle={() =>
                      setExpandedHotspot(
                        expandedHotspot === `${hotspot.file}:${hotspot.name}`
                          ? null
                          : `${hotspot.file}:${hotspot.name}`,
                      )
                    }
                  />
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

/* ════════════════════════════════════════════════════════════════
   Sub-components
   ════════════════════════════════════════════════════════════════ */

/* ── Stat Card ─────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  total,
  color,
  icon,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  icon: React.ReactNode;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border-default bg-bg-surface p-3"
    >
      <div className="flex items-center gap-1.5 mb-2" style={{ color }}>
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold text-text-primary">{value}</span>
        <span className="text-[10px] text-text-muted">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-elevated">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </motion.div>
  );
}

/* ── File Risk Bar ─────────────────────────────────────────────── */

function FileRiskBar({
  fileRisk,
  rank,
  hotspots,
  expanded,
  onToggle,
}: {
  fileRisk: FileRisk;
  rank: number;
  hotspots: RiskHotspot[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const shortPath = (file: string) => {
    const parts = file.split("/");
    return parts.length > 3 ? `…/${parts.slice(-3).join("/")}` : file;
  };

  const shortName = (name: string) => {
    const i = name.lastIndexOf("::");
    return i >= 0 ? name.slice(i + 2) : name;
  };

  const barWidth = Math.max(fileRisk.maxScore, 3);
  const avgWidth = Math.max(fileRisk.avgScore, 2);
  const sortedHotspots = [...hotspots].sort((a, b) => b.score - a.score);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.02 }}
      className="rounded-lg border border-transparent hover:border-border-default transition overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-bg-elevated/30 transition group text-left"
      >
        {/* Expand icon */}
        <span className="text-text-muted flex-shrink-0">
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>

        {/* Rank */}
        <span className="w-5 text-right text-[10px] text-text-muted font-mono">
          {rank}
        </span>

        {/* File path */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <FileCode className="h-3 w-3 text-text-muted flex-shrink-0" />
          <span className="text-[11px] font-mono text-text-secondary truncate">
            {shortPath(fileRisk.file)}
          </span>
          <span className="text-[9px] text-text-muted flex-shrink-0">
            {fileRisk.functionCount} fn{fileRisk.functionCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Risk bar */}
        <div className="w-40 flex-shrink-0">
          <div className="relative h-3 rounded-full bg-bg-elevated overflow-hidden">
            {/* Max score bar (faint) */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${barWidth}%` }}
              transition={{ duration: 0.5, delay: rank * 0.02 }}
              className="absolute inset-y-0 left-0 rounded-full opacity-30"
              style={{ backgroundColor: riskColor(fileRisk.maxScore) }}
            />
            {/* Average score bar (solid) */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${avgWidth}%` }}
              transition={{ duration: 0.6, delay: rank * 0.02 + 0.1 }}
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ backgroundColor: riskColor(fileRisk.avgScore) }}
            />
          </div>
        </div>

        {/* Score labels — avg / max */}
        <div className="w-20 text-right flex-shrink-0 flex items-baseline justify-end gap-1">
          <span
            className="text-xs font-bold"
            style={{ color: riskColor(fileRisk.maxScore) }}
          >
            {fileRisk.maxScore}
          </span>
          <span className="text-[9px] text-text-muted">max</span>
        </div>

        {/* Level badge */}
        <span
          className="w-14 text-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase flex-shrink-0"
          style={{
            color: levelColor(fileRisk.level),
            background: levelBg(fileRisk.level),
          }}
        >
          {fileRisk.level}
        </span>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border-subtle px-4 py-3 bg-bg-elevated/20 space-y-3">
              {/* Score summary */}
              <div className="flex items-center gap-4 text-[11px]">
                <span className="text-text-muted">
                  Avg score: <strong className="text-text-primary">{fileRisk.avgScore}</strong>
                </span>
                <span className="text-text-muted">
                  Max score: <strong style={{ color: riskColor(fileRisk.maxScore) }}>{fileRisk.maxScore}</strong>
                </span>
                <span className="text-text-muted">
                  Functions analyzed: <strong className="text-text-primary">{fileRisk.functionCount}</strong>
                </span>
              </div>

              {/* Functions in this file from hotspots */}
              {sortedHotspots.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Riskiest Functions in File
                  </div>
                  {sortedHotspots.slice(0, 8).map((h, i) => (
                    <div
                      key={`${h.name}-${i}`}
                      className="flex items-center gap-3 rounded-md bg-bg-surface px-3 py-2 border border-border-subtle"
                    >
                      <span className="text-[10px] text-text-muted font-mono w-4 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-text-primary">
                          {shortName(h.name)}
                        </span>
                        {h.line ? (
                          <span className="text-[10px] text-text-muted ml-1.5">line {h.line}</span>
                        ) : null}
                      </div>
                      <div className="w-16 flex-shrink-0">
                        <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(h.score, 3)}%`,
                              backgroundColor: riskColor(h.score),
                            }}
                          />
                        </div>
                      </div>
                      <span
                        className="text-[10px] font-bold w-6 text-right"
                        style={{ color: riskColor(h.score) }}
                      >
                        {h.score}
                      </span>
                      <span
                        className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded"
                        style={{
                          color: levelColor(h.level),
                          background: levelBg(h.level),
                        }}
                      >
                        {h.level}
                      </span>
                    </div>
                  ))}
                  {sortedHotspots.length > 8 && (
                    <div className="text-center text-[10px] text-text-muted py-1">
                      + {sortedHotspots.length - 8} more functions
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-text-muted">
                  💡 No hotspot functions detected in this file — risk is distributed across {fileRisk.functionCount} function{fileRisk.functionCount !== 1 ? "s" : ""} with lower individual scores.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Hotspot Row ───────────────────────────────────────────────── */

function HotspotRow({
  hotspot,
  rank,
  expanded,
  onToggle,
}: {
  hotspot: RiskHotspot;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const shortPath = (file: string) => {
    const parts = file.split("/");
    return parts.length > 3 ? `…/${parts.slice(-3).join("/")}` : file;
  };

  const shortName = (name: string) => {
    const i = name.lastIndexOf("::");
    return i >= 0 ? name.slice(i + 2) : name;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.025 }}
      className="rounded-lg border border-border-default overflow-hidden"
    >
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-elevated/30 transition text-left"
      >
        {/* Expand icon */}
        <span className="text-text-muted flex-shrink-0">
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>

        {/* Rank */}
        <span className="w-5 text-right text-[10px] text-text-muted font-mono flex-shrink-0">
          #{rank}
        </span>

        {/* Name and file */}
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-text-primary">
            {shortName(hotspot.name)}
          </span>
          <span className="text-[10px] text-text-muted ml-2">
            {shortPath(hotspot.file)}
            {hotspot.line ? `:${hotspot.line}` : ""}
          </span>
        </div>

        {/* Score bar */}
        <div className="w-24 flex-shrink-0">
          <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(hotspot.score, 3)}%`,
                backgroundColor: riskColor(hotspot.score),
              }}
            />
          </div>
        </div>

        {/* Score */}
        <span
          className="w-8 text-right text-xs font-bold flex-shrink-0"
          style={{ color: riskColor(hotspot.score) }}
        >
          {hotspot.score}
        </span>

        {/* Level badge */}
        <span
          className="w-14 text-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase flex-shrink-0"
          style={{
            color: levelColor(hotspot.level),
            background: levelBg(hotspot.level),
          }}
        >
          {hotspot.level}
        </span>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border-subtle px-4 py-3 bg-bg-elevated/20 space-y-3">
              {/* Recommendation */}
              <div className="text-[11px] text-text-secondary">
                💡 <span className="font-medium">{hotspot.recommendation}</span>
              </div>

              {/* Factor breakdown */}
              {hotspot.factors && hotspot.factors.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {hotspot.factors.map((f) => {
                    const label = FACTOR_LABELS[f.name] ?? f.name;
                    const pct = (f.score / 10) * 100;
                    return (
                      <div
                        key={f.name}
                        className="rounded-md border border-border-subtle bg-bg-surface px-2.5 py-2"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-text-muted">{label}</span>
                          <span
                            className="text-[10px] font-bold"
                            style={{ color: riskColor(f.score * 10) }}
                          >
                            {f.score.toFixed(1)}
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-bg-elevated overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: riskColor(f.score * 10),
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
