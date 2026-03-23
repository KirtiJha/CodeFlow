import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  GitCommit,
  Globe,
  Monitor,
  Search,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Shield,
  RefreshCw,
  GitCompare,
  X,
  FileCode,
  Plus,
  Minus,
  ChevronRight,
  Clock,
  User,
  Hash,
  Loader2,
} from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { useBranchStore } from "@/stores/branch-store";
import { useBranches } from "@/hooks/useBranches";
import { PAGE_VARIANTS } from "@/lib/constants";
import type { BranchInfo, BranchDiffResult } from "@/types/branch";

/* ── Helpers ───────────────────────────────────────────────────── */

function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function shortHash(hash: string): string {
  return hash?.slice(0, 7) ?? "";
}

/* ── Grouped branch model ──────────────────────────────────────── */

interface GroupedBranch {
  name: string;
  local: BranchInfo | null;
  remote: BranchInfo | null;
  isCurrent: boolean;
  commitHash: string;
  lastCommitDate: string | null;
  lastCommitMessage: string | null;
  author: string | null;
  ahead: number;
  behind: number;
}

function groupBranches(branches: BranchInfo[]): GroupedBranch[] {
  const map = new Map<string, GroupedBranch>();

  for (const b of branches) {
    if (!map.has(b.name)) {
      map.set(b.name, {
        name: b.name,
        local: null,
        remote: null,
        isCurrent: false,
        commitHash: b.commitHash,
        lastCommitDate: b.lastCommitDate ?? null,
        lastCommitMessage: b.lastCommitMessage ?? null,
        author: b.author ?? null,
        ahead: 0,
        behind: 0,
      });
    }
    const g = map.get(b.name)!;
    if (b.isRemote) {
      g.remote = b;
    } else {
      g.local = b;
      g.isCurrent = b.isCurrent;
      g.commitHash = b.commitHash;
      g.ahead = b.ahead ?? 0;
      g.behind = b.behind ?? 0;
    }
    // Prefer local branch info
    if (!b.isRemote || !g.local) {
      if (b.lastCommitDate) g.lastCommitDate = b.lastCommitDate;
      if (b.lastCommitMessage) g.lastCommitMessage = b.lastCommitMessage;
      if (b.author) g.author = b.author;
    }
  }

  // Sort: current first, then by date
  return [...map.values()].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    const da = a.lastCommitDate ? new Date(a.lastCommitDate).getTime() : 0;
    const db = b.lastCommitDate ? new Date(b.lastCommitDate).getTime() : 0;
    return db - da;
  });
}

/* ── Main page component ───────────────────────────────────────── */

export function BranchesPage() {
  const { branches, diffResult, prePushResult, isLoading } = useBranchStore();
  const { fetchBranches, diffBranches, prePushCheck } = useBranches();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareBranches, setCompareBranches] = useState<[string | null, string | null]>([null, null]);
  const [isDiffing, setIsDiffing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const grouped = useMemo(() => groupBranches(branches), [branches]);

  const filtered = useMemo(() => {
    if (!searchQuery) return grouped;
    const q = searchQuery.toLowerCase();
    return grouped.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.author?.toLowerCase().includes(q) ||
        g.lastCommitMessage?.toLowerCase().includes(q),
    );
  }, [grouped, searchQuery]);

  const currentBranch = useMemo(() => grouped.find((g) => g.isCurrent), [grouped]);
  const localCount = useMemo(() => grouped.filter((g) => g.local).length, [grouped]);
  const remoteCount = useMemo(() => grouped.filter((g) => g.remote).length, [grouped]);

  const handleCompareSelect = useCallback(
    (name: string) => {
      if (!compareMode) return;
      setCompareBranches(([a, b]) => {
        if (!a) return [name, null];
        if (a === name) return [null, null]; // deselect
        if (!b) return [a, name];
        return [name, null]; // restart
      });
    },
    [compareMode],
  );

  const handleRunDiff = useCallback(async () => {
    const [a, b] = compareBranches;
    if (!a || !b) return;
    setIsDiffing(true);
    await diffBranches(a, b);
    setIsDiffing(false);
  }, [compareBranches, diffBranches]);

  const handlePrePush = useCallback(async () => {
    if (!currentBranch) return;
    setIsChecking(true);
    await prePushCheck(currentBranch.name);
    setIsChecking(false);
  }, [currentBranch, prePushCheck]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <EmptyState
        icon="branch"
        title="No Branches Found"
        description="Analyze a Git repository to view branch information."
      />
    );
  }

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex h-full flex-col"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-text-primary">Branches</h2>
          <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs text-text-muted">
            {grouped.length} branch{grouped.length !== 1 ? "es" : ""}
          </span>
          {localCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-accent-blue/10 px-2 py-0.5 text-xs text-accent-blue">
              <Monitor className="h-3 w-3" /> {localCount} local
            </span>
          )}
          {remoteCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-accent-purple/10 px-2 py-0.5 text-xs text-accent-purple">
              <Globe className="h-3 w-3" /> {remoteCount} remote
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search branches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-48 rounded-lg border border-border-default bg-bg-surface pl-7 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
            />
          </div>
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              setCompareBranches([null, null]);
              useBranchStore.getState().setDiffResult(null);
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              compareMode
                ? "bg-accent-purple/15 text-accent-purple"
                : "bg-bg-surface text-text-secondary hover:bg-bg-elevated"
            }`}
          >
            <GitCompare className="h-3.5 w-3.5" />
            Compare
          </button>
          <button
            onClick={handlePrePush}
            disabled={!currentBranch || isChecking}
            className="flex items-center gap-1.5 rounded-lg bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-elevated disabled:opacity-50"
          >
            {isChecking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Shield className="h-3.5 w-3.5" />
            )}
            Pre-push Check
          </button>
          <button
            onClick={() => fetchBranches()}
            className="rounded-lg bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-elevated"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Compare bar ── */}
      <AnimatePresence>
        {compareMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border-default"
          >
            <div className="flex items-center gap-3 bg-accent-purple/5 px-4 py-2.5">
              <GitCompare className="h-4 w-4 text-accent-purple" />
              <span className="text-xs text-text-secondary">Compare:</span>
              <ComparePill
                label={compareBranches[0] ?? "Select branch A"}
                active={!!compareBranches[0]}
                onClear={() => setCompareBranches([null, null])}
              />
              <span className="text-xs text-text-muted">↔</span>
              <ComparePill
                label={compareBranches[1] ?? "Select branch B"}
                active={!!compareBranches[1]}
                onClear={() => setCompareBranches([compareBranches[0], null])}
              />
              <button
                onClick={handleRunDiff}
                disabled={!compareBranches[0] || !compareBranches[1] || isDiffing}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-accent-purple px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-purple/80 disabled:opacity-40"
              >
                {isDiffing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitCompare className="h-3.5 w-3.5" />}
                Run Diff
              </button>
              <button
                onClick={() => {
                  setCompareMode(false);
                  setCompareBranches([null, null]);
                  useBranchStore.getState().setDiffResult(null);
                }}
                className="rounded-lg p-1 text-text-muted transition hover:bg-bg-elevated hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pre-push result banner ── */}
      <AnimatePresence>
        {prePushResult && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border-default"
          >
            <div
              className={`flex items-center gap-3 px-4 py-2.5 ${
                prePushResult.safe
                  ? "bg-accent-green/5"
                  : "bg-accent-red/5"
              }`}
            >
              {prePushResult.safe ? (
                <CheckCircle2 className="h-4 w-4 text-accent-green" />
              ) : (
                <Shield className="h-4 w-4 text-accent-red" />
              )}
              <div className="flex-1">
                <span className={`text-xs font-medium ${prePushResult.safe ? "text-accent-green" : "text-accent-red"}`}>
                  {prePushResult.safe ? "Safe to push" : "Push may cause issues"}
                </span>
                <span className="ml-2 text-xs text-text-muted">
                  {prePushResult.recommendation ?? prePushResult.message ?? ""}
                  {prePushResult.filesChanged != null && ` · ${prePushResult.filesChanged} files changed`}
                </span>
              </div>
              <button
                onClick={() => useBranchStore.getState().setPrePushResult(null)}
                className="rounded p-1 text-text-muted hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-4 space-y-2">
          {/* Branch cards */}
          {filtered.map((branch, i) => {
            const isCompareA = compareBranches[0] === branch.name;
            const isCompareB = compareBranches[1] === branch.name;
            const isCompareSelected = isCompareA || isCompareB;

            return (
              <motion.div
                key={branch.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => {
                  if (compareMode) {
                    handleCompareSelect(branch.name);
                  } else {
                    setSelectedBranch(selectedBranch === branch.name ? null : branch.name);
                  }
                }}
                className={`group cursor-pointer rounded-xl border p-4 transition-all ${
                  isCompareSelected
                    ? "border-accent-purple/50 bg-accent-purple/5"
                    : branch.isCurrent
                      ? "border-accent-blue/30 bg-accent-blue/5"
                      : selectedBranch === branch.name
                        ? "border-accent-blue/40 bg-bg-surface"
                        : "border-border-default bg-bg-surface hover:border-border-focus"
                }`}
              >
                {/* Top row */}
                <div className="flex items-center gap-3">
                  {/* Branch icon */}
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      branch.isCurrent
                        ? "bg-accent-blue/15"
                        : "bg-bg-elevated"
                    }`}
                  >
                    <GitBranch
                      className={`h-4 w-4 ${
                        branch.isCurrent ? "text-accent-blue" : "text-text-muted"
                      }`}
                    />
                  </div>

                  {/* Name + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary truncate">
                        {branch.name}
                      </span>
                      {branch.isCurrent && (
                        <span className="rounded-full bg-accent-blue/15 px-2 py-0.5 text-[10px] font-semibold text-accent-blue">
                          HEAD
                        </span>
                      )}
                      {branch.local && (
                        <span className="flex items-center gap-0.5 text-[10px] text-accent-blue" title="Local branch">
                          <Monitor className="h-2.5 w-2.5" /> local
                        </span>
                      )}
                      {branch.remote && (
                        <span className="flex items-center gap-0.5 text-[10px] text-accent-purple" title="Remote branch">
                          <Globe className="h-2.5 w-2.5" /> remote
                        </span>
                      )}
                      {isCompareA && (
                        <span className="rounded bg-accent-purple/15 px-1.5 py-0.5 text-[9px] font-bold text-accent-purple">A</span>
                      )}
                      {isCompareB && (
                        <span className="rounded bg-accent-amber/15 px-1.5 py-0.5 text-[9px] font-bold text-accent-amber">B</span>
                      )}
                    </div>

                    {/* Meta line */}
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-text-muted">
                      <span className="flex items-center gap-1 font-mono">
                        <Hash className="h-2.5 w-2.5" />
                        {shortHash(branch.commitHash)}
                      </span>
                      {branch.author && (
                        <span className="flex items-center gap-1">
                          <User className="h-2.5 w-2.5" />
                          {branch.author}
                        </span>
                      )}
                      {branch.lastCommitDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {formatRelative(branch.lastCommitDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ahead/Behind */}
                  <div className="flex items-center gap-2">
                    {(branch.ahead > 0 || branch.behind > 0) && branch.local && (
                      <div className="flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-elevated px-2 py-1">
                        <span className={`flex items-center gap-0.5 text-[10px] font-medium ${branch.ahead > 0 ? "text-accent-green" : "text-text-muted"}`}>
                          <ArrowUp className="h-3 w-3" /> {branch.ahead}
                        </span>
                        <span className="text-border-default">|</span>
                        <span className={`flex items-center gap-0.5 text-[10px] font-medium ${branch.behind > 0 ? "text-accent-red" : "text-text-muted"}`}>
                          <ArrowDown className="h-3 w-3" /> {branch.behind}
                        </span>
                      </div>
                    )}
                    <ChevronRight
                      className={`h-4 w-4 text-text-muted transition-transform ${
                        selectedBranch === branch.name ? "rotate-90" : ""
                      }`}
                    />
                  </div>
                </div>

                {/* Commit message */}
                {branch.lastCommitMessage && (
                  <div className="mt-2 ml-12 flex items-start gap-2">
                    <GitCommit className="mt-0.5 h-3 w-3 text-text-muted/50 flex-shrink-0" />
                    <span className="text-xs text-text-secondary truncate">
                      {branch.lastCommitMessage}
                    </span>
                  </div>
                )}

                {/* Expanded detail */}
                <AnimatePresence>
                  {selectedBranch === branch.name && !compareMode && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 ml-12 grid grid-cols-2 gap-3 rounded-lg border border-border-default bg-bg-elevated/50 p-3">
                        <DetailItem label="Commit" value={branch.commitHash} mono />
                        <DetailItem label="Author" value={branch.author ?? "—"} />
                        <DetailItem label="Last Activity" value={branch.lastCommitDate ? new Date(branch.lastCommitDate).toLocaleString() : "—"} />
                        <DetailItem
                          label="Tracking"
                          value={
                            branch.local && branch.remote
                              ? "Local + Remote"
                              : branch.local
                                ? "Local only"
                                : "Remote only"
                          }
                        />
                        {branch.local && (
                          <>
                            <DetailItem label="Ahead" value={`${branch.ahead} commit${branch.ahead !== 1 ? "s" : ""}`} color={branch.ahead > 0 ? "text-accent-green" : undefined} />
                            <DetailItem label="Behind" value={`${branch.behind} commit${branch.behind !== 1 ? "s" : ""}`} color={branch.behind > 0 ? "text-accent-red" : undefined} />
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-text-muted">
              No branches match "{searchQuery}"
            </div>
          )}
        </div>

        {/* ── Diff result panel ── */}
        <AnimatePresence>
          {diffResult && (
            <DiffResultPanel
              result={diffResult}
              onClose={() => useBranchStore.getState().setDiffResult(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ── Sub-components ────────────────────────────────────────────── */

function ComparePill({
  label,
  active,
  onClear,
}: {
  label: string;
  active: boolean;
  onClear: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
        active
          ? "border-accent-purple/40 bg-accent-purple/10 text-accent-purple font-medium"
          : "border-border-default bg-bg-surface text-text-muted"
      }`}
    >
      <GitBranch className="h-3 w-3" />
      {label}
      {active && (
        <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="ml-0.5 hover:text-text-primary">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

function DetailItem({
  label,
  value,
  mono,
  color,
}: {
  label: string;
  value: string;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-0.5">
        {label}
      </div>
      <div className={`text-xs ${color ?? "text-text-secondary"} ${mono ? "font-mono" : ""} truncate`}>
        {value}
      </div>
    </div>
  );
}

function DiffResultPanel({
  result,
  onClose,
}: {
  result: BranchDiffResult;
  onClose: () => void;
}) {
  const totalAdded = result.diffs.reduce((s, d) => s + d.linesAdded, 0);
  const totalRemoved = result.diffs.reduce((s, d) => s + d.linesRemoved, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="mx-auto max-w-5xl px-4 pb-4"
    >
      <div className="rounded-xl border border-border-default bg-bg-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default bg-bg-elevated/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <GitCompare className="h-4 w-4 text-accent-purple" />
            <span className="text-sm font-semibold text-text-primary">
              {result.branchA}
              <span className="mx-2 text-text-muted">↔</span>
              {result.branchB}
            </span>
            <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs text-text-muted">
              {result.filesChanged} file{result.filesChanged !== 1 ? "s" : ""} changed
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-accent-green">
              <Plus className="h-3 w-3" /> {totalAdded}
            </span>
            <span className="flex items-center gap-1 text-xs text-accent-red">
              <Minus className="h-3 w-3" /> {totalRemoved}
            </span>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-text-muted transition hover:bg-bg-elevated hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* File list */}
        <div className="divide-y divide-border-subtle max-h-80 overflow-auto">
          {result.diffs.map((d, i) => {
            const statusColor =
              d.status === "A" || d.status === "added"
                ? "text-accent-green"
                : d.status === "D" || d.status === "deleted"
                  ? "text-accent-red"
                  : d.status === "R" || d.status === "renamed"
                    ? "text-accent-amber"
                    : "text-accent-blue";
            const statusLabel =
              d.status === "A" || d.status === "added"
                ? "A"
                : d.status === "D" || d.status === "deleted"
                  ? "D"
                  : d.status === "R" || d.status === "renamed"
                    ? "R"
                    : "M";

            return (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2 text-xs hover:bg-bg-elevated/30 transition"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${statusColor} bg-current/10`}
                  style={{ backgroundColor: undefined }}
                >
                  <span className={statusColor}>{statusLabel}</span>
                </span>
                <FileCode className="h-3 w-3 text-text-muted flex-shrink-0" />
                <span className="font-mono text-text-primary truncate flex-1">
                  {d.file}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {d.linesAdded > 0 && (
                    <span className="text-accent-green">+{d.linesAdded}</span>
                  )}
                  {d.linesRemoved > 0 && (
                    <span className="text-accent-red">-{d.linesRemoved}</span>
                  )}
                </div>
              </div>
            );
          })}
          {result.diffs.length === 0 && (
            <div className="py-8 text-center text-xs text-text-muted">
              No file differences found
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
