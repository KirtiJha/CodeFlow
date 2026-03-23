import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX,
  Search, RefreshCw, ChevronDown, ChevronRight,
  FileCode, AlertTriangle, ArrowRight, X, Bug, Eye,
} from "lucide-react";
import { TaintFlowDiagram } from "@/components/security/TaintFlowDiagram";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useSecurityStore } from "@/stores/security-store";
import { api } from "@/lib/api-client";
import { PAGE_VARIANTS } from "@/lib/constants";
import type { SecurityReport, SecurityScore, TaintFlow, TaintSeverity } from "@/types/security";

/* ── Severity helpers ─────────────────────────────────────────── */

const SEV_CONFIG: Record<string, { color: string; bg: string; icon: typeof ShieldAlert; label: string; order: number }> = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", icon: ShieldX, label: "Critical", order: 0 },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.1)", icon: ShieldAlert, label: "High", order: 1 },
  medium:   { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", icon: AlertTriangle, label: "Medium", order: 2 },
  low:      { color: "#10b981", bg: "rgba(16,185,129,0.1)", icon: Shield, label: "Low", order: 3 },
};

function sevConf(s: string) {
  return SEV_CONFIG[s] ?? SEV_CONFIG.medium;
}

const CAT_LABELS: Record<string, string> = {
  sql_injection: "SQL Injection",
  xss: "Cross-Site Scripting",
  command_injection: "Command Injection",
  path_traversal: "Path Traversal",
  ssrf: "Server-Side Request Forgery",
  open_redirect: "Open Redirect",
  pii_leak: "PII Leak",
  log_injection: "Log Injection",
  prototype_pollution: "Prototype Pollution",
  insecure_deserialization: "Insecure Deserialization",
  hardcoded_secret: "Hardcoded Secret",
  missing_auth: "Missing Auth Check",
  unsafe_regex: "Unsafe Regex",
  dependency_risk: "Dependency Risk",
};

function catLabel(cat: string): string {
  return CAT_LABELS[cat] ?? cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Grade helpers ────────────────────────────────────────────── */

function gradeInfo(overall: number) {
  if (overall >= 90) return { label: "A", color: "#10b981", desc: "Excellent" };
  if (overall >= 75) return { label: "B", color: "#3b82f6", desc: "Good" };
  if (overall >= 60) return { label: "C", color: "#f59e0b", desc: "Fair" };
  if (overall >= 40) return { label: "D", color: "#f97316", desc: "Poor" };
  return { label: "F", color: "#ef4444", desc: "Critical" };
}

/* ── Main SecurityPage ────────────────────────────────────────── */

export function SecurityPage() {
  const {
    report, score, selectedFlow, filterSeverity, filterCategory,
    setReport, setScore, selectFlow, setFilterSeverity, setFilterCategory,
  } = useSecurityStore();
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const scan = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reportRes, scoreRes] = await Promise.all([
        api.securityReport(),
        api.securityScan(),
      ]);
      setReport(reportRes.data as SecurityReport);
      setScore(scoreRes.data as SecurityScore);
    } catch {
      // handled by api-client
    } finally {
      setIsLoading(false);
    }
  }, [setReport, setScore]);

  useEffect(() => {
    if (!report) scan();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Filtering ── */
  const allFlows = report?.flows ?? [];
  const filteredFlows = allFlows.filter((f) => {
    if (filterSeverity && f.severity !== filterSeverity) return false;
    if (filterCategory && f.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        f.category.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q) ||
        f.source?.file?.toLowerCase().includes(q) ||
        f.sink?.file?.toLowerCase().includes(q) ||
        f.source?.symbol?.toLowerCase().includes(q) ||
        f.sink?.symbol?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const categories = [...new Set(allFlows.map((f) => f.category))].sort();

  /* ── Group flows by category ── */
  const grouped = new Map<string, TaintFlow[]>();
  for (const f of filteredFlows) {
    if (!grouped.has(f.category)) grouped.set(f.category, []);
    grouped.get(f.category)!.push(f);
  }
  // Sort groups: highest severity first
  const sortedGroups = [...grouped.entries()].sort((a, b) => {
    const aMax = Math.min(...a[1].map((f) => sevConf(f.severity).order));
    const bMax = Math.min(...b[1].map((f) => sevConf(f.severity).order));
    return aMax - bMax;
  });

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  /* ── Severity summary counts ── */
  const sevCounts = {
    critical: allFlows.filter((f) => f.severity === "critical").length,
    high: allFlows.filter((f) => f.severity === "high").length,
    medium: allFlows.filter((f) => f.severity === "medium").length,
    low: allFlows.filter((f) => f.severity === "low").length,
  };

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex h-full flex-col"
    >
      {/* ── Header ── */}
      <div className="border-b border-border-default px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-accent-blue" />
            <h2 className="text-sm font-semibold text-text-primary">
              Security Analysis
            </h2>
            {report && (
              <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs text-text-muted">
                {allFlows.length} finding{allFlows.length !== 1 ? "s" : ""}
              </span>
            )}
            {report && sevCounts.critical > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                <ShieldX className="h-3 w-3" /> {sevCounts.critical} critical
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={scan}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg bg-accent-blue px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-accent-blue/90 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Scanning..." : "Scan"}
            </button>
          </div>
        </div>

        {/* Filters */}
        {report && allFlows.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search findings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 w-full rounded-lg border border-border-default bg-bg-surface pl-7 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
              />
            </div>

            {/* Severity pills */}
            <div className="flex items-center gap-1">
              {(["critical", "high", "medium", "low"] as const).map((sev) => {
                const cnt = sevCounts[sev];
                if (cnt === 0) return null;
                const active = filterSeverity === sev;
                const conf = sevConf(sev);
                return (
                  <button
                    key={sev}
                    onClick={() => setFilterSeverity(active ? null : sev)}
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all"
                    style={{
                      background: active ? conf.bg : "transparent",
                      color: active ? conf.color : "#8888aa",
                      border: `1px solid ${active ? conf.color + "40" : "#2a2a3e"}`,
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: conf.color }} />
                    {conf.label} ({cnt})
                  </button>
                );
              })}
            </div>

            {/* Category filter */}
            {categories.length > 1 && (
              <select
                value={filterCategory ?? ""}
                onChange={(e) => setFilterCategory(e.target.value || null)}
                className="h-7 rounded-lg border border-border-default bg-bg-surface px-2 text-xs text-text-primary focus:border-accent-blue focus:outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{catLabel(c)}</option>
                ))}
              </select>
            )}

            {/* View mode toggle */}
            <div className="ml-auto flex rounded-lg border border-border-default overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`px-2 py-1 text-[10px] font-medium transition-all ${viewMode === "list" ? "bg-accent-blue/15 text-accent-blue" : "text-text-muted hover:bg-bg-elevated"}`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("graph")}
                className={`px-2 py-1 text-[10px] font-medium transition-all ${viewMode === "graph" ? "bg-accent-blue/15 text-accent-blue" : "text-text-muted hover:bg-bg-elevated"}`}
              >
                Graph
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : !report ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-2xl bg-bg-elevated/50 p-6">
              <Shield className="mx-auto h-12 w-12 text-accent-blue/50" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-primary">Security Analysis</h3>
              <p className="mt-1 text-xs text-text-muted max-w-xs">
                Scan your codebase for taint flows, hardcoded secrets, missing auth, and dangerous patterns.
              </p>
            </div>
            <button
              onClick={scan}
              className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/90"
            >
              Run Security Scan
            </button>
          </div>
        ) : viewMode === "graph" && filteredFlows.length > 0 ? (
          <Allotment>
            <Allotment.Pane minSize={400}>
              <TaintFlowDiagram
                flows={filteredFlows}
                selectedFlowId={selectedFlow?.id}
                onFlowSelect={selectFlow}
              />
            </Allotment.Pane>
            <Allotment.Pane minSize={280} preferredSize={340}>
              <div className="flex h-full flex-col border-l border-border-default overflow-auto">
                {score && <ScoreHeader score={score} />}
                <div className="flex-1 overflow-auto p-3 space-y-2">
                  {filteredFlows.map((flow) => (
                    <FindingCard
                      key={flow.id}
                      flow={flow}
                      selected={selectedFlow?.id === flow.id}
                      onClick={() => selectFlow(selectedFlow?.id === flow.id ? null : flow)}
                    />
                  ))}
                </div>
              </div>
            </Allotment.Pane>
          </Allotment>
        ) : (
          /* ── List view (default) ── */
          <div className="h-full overflow-auto">
            <div className="mx-auto max-w-5xl p-4 space-y-4">
              {/* Score overview */}
              {score && <ScoreOverview score={score} sevCounts={sevCounts} />}

              {/* Findings */}
              {filteredFlows.length === 0 ? (
                <div className="rounded-xl border border-border-default bg-bg-surface p-8 text-center">
                  <ShieldCheck className="mx-auto h-10 w-10 text-green-400/60" />
                  <h3 className="mt-3 text-sm font-medium text-text-primary">
                    {allFlows.length === 0 ? "No Issues Found" : "No Matching Findings"}
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">
                    {allFlows.length === 0
                      ? "Your codebase passed all security checks."
                      : "Try adjusting your filters to see more results."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedGroups.map(([cat, flows]) => (
                    <CategoryGroup
                      key={cat}
                      category={cat}
                      flows={flows}
                      expanded={expandedCategories.has(cat) || sortedGroups.length <= 3}
                      onToggle={() => toggleCategory(cat)}
                      selectedId={selectedFlow?.id}
                      onSelect={(f) => selectFlow(selectedFlow?.id === f.id ? null : f)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Selected finding detail drawer ── */}
      <AnimatePresence>
        {selectedFlow && viewMode === "list" && (
          <FindingDrawer flow={selectedFlow} onClose={() => selectFlow(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Score Header (compact, for graph panel) ──────────────────── */

function ScoreHeader({ score }: { score: SecurityScore }) {
  const grade = gradeInfo(score.overall);
  return (
    <div className="border-b border-border-default px-4 py-3 flex items-center gap-3">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold"
        style={{ background: grade.color + "20", color: grade.color }}
      >
        {grade.label}
      </div>
      <div>
        <div className="text-sm font-semibold text-text-primary">{score.overall}/100</div>
        <div className="text-[10px] text-text-muted">{grade.desc} — {score.totalFlows} findings</div>
      </div>
    </div>
  );
}

/* ── Score Overview (full, for list view) ─────────────────────── */

function ScoreOverview({ score, sevCounts }: { score: SecurityScore; sevCounts: Record<string, number> }) {
  const grade = gradeInfo(score.overall);
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (score.overall / 100) * circumference;

  const bars = [
    { label: "Taint Analysis", value: score.taintScore },
    { label: "Input Validation", value: score.inputValidation },
    { label: "Dependency Safety", value: score.dependencySafety },
    { label: "Data Flow", value: score.dataFlowScore },
  ];

  return (
    <div className="rounded-xl border border-border-default bg-bg-surface overflow-hidden">
      <div className="flex items-stretch divide-x divide-border-default">
        {/* Grade circle */}
        <div className="flex-shrink-0 flex items-center justify-center p-5">
          <div className="relative">
            <svg width="96" height="96" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r="38" fill="none" stroke="#1a1a2e" strokeWidth="5" />
              <motion.circle
                cx="42" cy="42" r="38" fill="none"
                stroke={grade.color} strokeWidth="5" strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                transform="rotate(-90 42 42)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: grade.color }}>{grade.label}</span>
              <span className="text-[10px] text-text-muted">{score.overall}/100</span>
            </div>
          </div>
        </div>

        {/* Category bars */}
        <div className="flex-1 p-4 space-y-2.5">
          {bars.map((bar) => {
            const g = gradeInfo(bar.value);
            return (
              <div key={bar.label}>
                <div className="flex items-center justify-between text-[11px] mb-0.5">
                  <span className="text-text-secondary">{bar.label}</span>
                  <span style={{ color: g.color }}>{bar.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${bar.value}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: g.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Severity counts */}
        <div className="flex-shrink-0 grid grid-cols-2 gap-2 p-4">
          {(["critical", "high", "medium", "low"] as const).map((sev) => {
            const conf = sevConf(sev);
            return (
              <div key={sev} className="rounded-lg bg-bg-elevated/50 px-3 py-2 text-center min-w-[70px]">
                <div className="text-lg font-bold" style={{ color: sevCounts[sev] > 0 ? conf.color : "#555" }}>
                  {sevCounts[sev]}
                </div>
                <div className="text-[9px] text-text-muted">{conf.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Category Group ───────────────────────────────────────────── */

function CategoryGroup({
  category, flows, expanded, onToggle, selectedId, onSelect,
}: {
  category: string;
  flows: TaintFlow[];
  expanded: boolean;
  onToggle: () => void;
  selectedId?: string | null;
  onSelect: (f: TaintFlow) => void;
}) {
  const maxSev = flows.reduce(
    (max, f) => (sevConf(f.severity).order < sevConf(max).order ? f.severity : max),
    "low" as string,
  );
  const conf = sevConf(maxSev);

  return (
    <div className="rounded-xl border border-border-default bg-bg-surface overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-elevated/30"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-text-muted flex-shrink-0" />
        )}
        <conf.icon className="h-4 w-4 flex-shrink-0" style={{ color: conf.color }} />
        <span className="text-sm font-medium text-text-primary">{catLabel(category)}</span>
        <span className="ml-auto flex items-center gap-2 text-xs text-text-muted">
          {flows.length} finding{flows.length !== 1 ? "s" : ""}
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: conf.bg, color: conf.color }}
          >
            {sevConf(maxSev).label}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border-default divide-y divide-border-subtle">
              {flows.map((flow) => (
                <FindingRow
                  key={flow.id}
                  flow={flow}
                  selected={selectedId === flow.id}
                  onClick={() => onSelect(flow)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Finding Row (inside category group) ──────────────────────── */

function FindingRow({ flow, selected, onClick }: { flow: TaintFlow; selected: boolean; onClick: () => void }) {
  const conf = sevConf(flow.severity);
  const source = flow.path?.[0] ?? flow.source;
  const sink = flow.path?.[flow.path.length - 1] ?? flow.sink;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all ${
        selected ? "bg-accent-blue/5" : "hover:bg-bg-elevated/20"
      }`}
    >
      <span
        className="mt-0.5 h-2 w-2 rounded-full flex-shrink-0"
        style={{ background: conf.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-primary line-clamp-2">
          {flow.description || `${catLabel(flow.category)} vulnerability`}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-text-muted">
          <span className="flex items-center gap-1 truncate">
            <FileCode className="h-3 w-3 flex-shrink-0" />
            {source?.file}:{source?.line}
          </span>
          {sink && sink !== source && (
            <>
              <ArrowRight className="h-3 w-3 flex-shrink-0 text-text-muted/50" />
              <span className="truncate">
                {sink?.file}:{sink?.line}
              </span>
            </>
          )}
        </div>
      </div>
      <span
        className="flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium"
        style={{ background: conf.bg, color: conf.color }}
      >
        {conf.label}
      </span>
    </button>
  );
}

/* ── Finding Card (graph panel) ───────────────────────────────── */

function FindingCard({ flow, selected, onClick }: { flow: TaintFlow; selected: boolean; onClick: () => void }) {
  const conf = sevConf(flow.severity);
  const source = flow.path?.[0] ?? flow.source;
  const sink = flow.path?.[flow.path.length - 1] ?? flow.sink;

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition-all ${
        selected
          ? "border-accent-blue bg-accent-blue/5"
          : "border-border-default bg-bg-surface hover:border-border-focus"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium text-text-primary line-clamp-2">
          {catLabel(flow.category)}
        </span>
        <span
          className="flex-shrink-0 h-1.5 w-1.5 rounded-full mt-1"
          style={{ background: conf.color }}
        />
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-text-muted">
        <span className="font-mono truncate" style={{ color: "#ef4444" }}>{source?.symbol}</span>
        <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" />
        <span className="font-mono truncate" style={{ color: "#f59e0b" }}>{sink?.symbol}</span>
      </div>
    </motion.button>
  );
}

/* ── Finding Detail Drawer ────────────────────────────────────── */

function FindingDrawer({ flow, onClose }: { flow: TaintFlow; onClose: () => void }) {
  const conf = sevConf(flow.severity);
  const source = flow.path?.[0] ?? flow.source;
  const sink = flow.path?.[flow.path.length - 1] ?? flow.sink;

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="absolute bottom-0 left-0 right-0 z-20 border-t border-border-default bg-bg-surface shadow-xl shadow-black/40"
      style={{ maxHeight: "45%" }}
    >
      <div className="flex items-center justify-between border-b border-border-default px-4 py-2.5">
        <div className="flex items-center gap-2">
          <conf.icon className="h-4 w-4" style={{ color: conf.color }} />
          <span className="text-sm font-semibold text-text-primary">
            {catLabel(flow.category)}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: conf.bg, color: conf.color }}
          >
            {conf.label}
          </span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-text-muted hover:bg-bg-elevated hover:text-text-primary">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-auto p-4" style={{ maxHeight: "calc(45vh - 44px)" }}>
        <div className="grid grid-cols-2 gap-4">
          {/* Left: details */}
          <div className="space-y-3">
            {flow.description && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Description</div>
                <p className="text-xs text-text-secondary">{flow.description}</p>
              </div>
            )}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Fix</div>
              <p className="text-xs text-text-secondary">{flow.fix}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Source</div>
                <div className="text-xs">
                  <span className="font-mono text-red-400">{source?.symbol}</span>
                  <div className="text-[10px] text-text-muted mt-0.5">{source?.file}:{source?.line}</div>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Sink</div>
                <div className="text-xs">
                  <span className="font-mono text-amber-400">{sink?.symbol}</span>
                  <div className="text-[10px] text-text-muted mt-0.5">{sink?.file}:{sink?.line}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: flow path */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
              Flow Path ({flow.path.length} step{flow.path.length !== 1 ? "s" : ""})
            </div>
            <div className="space-y-1">
              {flow.path.map((step, i) => {
                const isFirst = i === 0;
                const isLast = i === flow.path.length - 1;
                return (
                  <div
                    key={`${step.file}-${step.line}-${i}`}
                    className="flex items-start gap-2 text-[11px]"
                  >
                    <div className="flex flex-col items-center pt-1">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{
                          background: isFirst ? "#ef4444" : isLast ? "#f59e0b" : "#3b82f6",
                        }}
                      />
                      {!isLast && <div className="w-px h-3 bg-border-default" />}
                    </div>
                    <div className="min-w-0">
                      <span className="font-mono text-text-primary truncate block">{step.symbol}</span>
                      <span className="text-[10px] text-text-muted">{step.file}:{step.line}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
