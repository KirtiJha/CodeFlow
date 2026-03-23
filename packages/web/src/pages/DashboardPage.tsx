import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCode,
  GitBranch,
  Activity,
  Network,
  Database,
  Trash2,
  FolderOpen,
  Clock,
  HardDrive,
  Globe,
  Plus,
  Search,
  RefreshCw,
  ChevronRight,
  Zap,
  Code2,
  Layers,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { useAnalysisStore } from "@/stores/analysis-store";
import { useAppStore } from "@/stores/app-store";
import { useSSE } from "@/hooks/useSSE";
import { api } from "@/lib/api-client";
import { PAGE_VARIANTS, ROUTES, PHASE_NAMES } from "@/lib/constants";
import {
  formatNumber,
  formatDuration,
  formatRelativeTime,
} from "@/lib/formatters";

/* ── Types ─────────────────────────────────────────────────────── */

interface RepoInfo {
  id: string;
  name: string;
  path: string;
  dbSize: number;
  isCloned: boolean;
  isActive: boolean;
  stats: {
    nodes: number;
    edges: number;
    files: number;
    functions: number;
    classes: number;
    languages: string[];
    analyzedAt: string | null;
    duration: number | null;
  } | null;
}

/* ── Main component ────────────────────────────────────────────── */

export function DashboardPage() {
  const navigate = useNavigate();
  const { progress, isRunning } = useAnalysisStore();
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [analyzeInput, setAnalyzeInput] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // SSE for live analysis updates
  useSSE("analysis-progress", (data) => {
    useAnalysisStore
      .getState()
      .updateProgress(
        data as unknown as import("@/types/analysis").PipelineProgress,
      );
  });

  useSSE("analysis-complete", () => {
    useAnalysisStore.getState().setRunning(false);
    loadRepos();
  });

  const loadRepos = useCallback(async () => {
    try {
      const res = await api.listRepos();
      setRepos(res.data?.repos ?? []);
    } catch {
      // If endpoint doesn't exist yet, fall back to status
      try {
        const status = await api.getStatus();
        if (status.data?.indexed && status.data.repoPath) {
          const s = status.data.stats as Record<string, unknown>;
          setRepos([
            {
              id: status.data.repoPath,
              name: (status.data.repoPath as string).split("/").pop() ?? "unknown",
              path: status.data.repoPath as string,
              dbSize: 0,
              isCloned: false,
              isActive: true,
              stats: {
                nodes: (s?.nodes as number) ?? 0,
                edges: (s?.edges as number) ?? 0,
                files: (s?.files as number) ?? 0,
                functions: (s?.functions as number) ?? 0,
                classes: (s?.classes as number) ?? 0,
                languages: (s?.languages as string[]) ?? [],
                analyzedAt: (s?.lastAnalyzed as string) ?? null,
                duration: (s?.duration as number) ?? null,
              },
            },
          ]);
        }
      } catch {
        /* empty */
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  const handleSwitch = useCallback(
    async (repo: RepoInfo) => {
      if (repo.isActive) return;
      try {
        await api.switchRepo(repo.path);
        // Update stats
        const status = await api.getStatus();
        if (status.data?.stats && status.data.indexed) {
          const s = status.data.stats as Record<string, unknown>;
          useAnalysisStore.getState().setStats({
            totalFiles: (s.files as number) ?? 0,
            totalNodes: (s.nodes as number) ?? 0,
            totalEdges: (s.edges as number) ?? 0,
            totalSymbols:
              ((s.functions as number) ?? 0) + ((s.classes as number) ?? 0),
            totalFunctions: (s.functions as number) ?? 0,
            totalClasses: (s.classes as number) ?? 0,
            totalCommunities: (s.communities as number) ?? 0,
            functions: (s.functions as number) ?? 0,
            classes: (s.classes as number) ?? 0,
            communities: (s.communities as number) ?? 0,
            callEdges: (s.edges as number) ?? 0,
            languages: (s.languages as string[]) ?? [],
            dataFlowEdges: (s.dataFlowEdges as number) ?? 0,
            duration: (s.duration as number) ?? undefined,
            lastAnalyzed: (s.lastAnalyzed as string) ?? undefined,
          } as import("@/types/analysis").AnalysisStats);
          useAppStore.getState().setAnalyzed(true);
        }
        loadRepos();
      } catch {
        /* ignore */
      }
    },
    [loadRepos],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await api.deleteRepo(id);
        setDeleteConfirm(null);
        loadRepos();
      } catch {
        /* ignore */
      }
    },
    [loadRepos],
  );

  const handleAnalyze = useCallback(
    async (repoPath: string) => {
      setIsAnalyzing(true);
      try {
        const res = await api.startAnalysis(repoPath);
        if (res.data?.jobId) {
          useAnalysisStore.getState().setRunning(true);
          useAnalysisStore
            .getState()
            .updateProgress({
              phase: "initializing",
              phaseIndex: 0,
              totalPhases: 12,
              current: 0,
              total: 100,
              percent: 0,
              message: "Starting analysis...",
            });
        }
        setShowAddForm(false);
        setAnalyzeInput("");
        // Reload after a brief delay to pick up the new repo
        setTimeout(loadRepos, 2000);
      } catch {
        /* ignore */
      } finally {
        setIsAnalyzing(false);
      }
    },
    [loadRepos],
  );

  const handleCloneAndAnalyze = useCallback(async () => {
    if (!analyzeInput.trim()) return;
    setIsAnalyzing(true);
    try {
      // If it looks like a GitHub URL, clone first
      if (
        analyzeInput.includes("github.com") ||
        analyzeInput.startsWith("git@")
      ) {
        const cloneRes = await api.cloneRepo(analyzeInput.trim());
        if (cloneRes.data?.repoPath) {
          await handleAnalyze(cloneRes.data.repoPath);
        }
      } else {
        // Treat as local path
        await handleAnalyze(analyzeInput.trim());
      }
    } catch {
      /* ignore */
    } finally {
      setIsAnalyzing(false);
    }
  }, [analyzeInput, handleAnalyze]);

  const filteredRepos = searchQuery
    ? repos.filter(
        (r) =>
          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.path.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : repos;

  const activeRepo = repos.find((r) => r.isActive);
  const totalFiles = repos.reduce(
    (s, r) => s + (r.stats?.files ?? 0),
    0,
  );
  const totalFunctions = repos.reduce(
    (s, r) => s + (r.stats?.functions ?? 0),
    0,
  );

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex h-full flex-col"
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="border-b border-border-default px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">
              Dashboard
            </h1>
            <p className="mt-0.5 text-xs text-text-muted">
              Manage your analyzed repositories
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadRepos}
              className="flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-surface px-3 py-1.5 text-xs text-text-secondary transition hover:bg-bg-elevated"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 rounded-lg bg-accent-blue px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-blue/90"
            >
              <Plus className="h-3 w-3" />
              Add Repository
            </button>
          </div>
        </div>

        {/* ── Analysis progress bar ────────────────────────────── */}
        <AnimatePresence>
          {isRunning && progress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3"
            >
              <div className="rounded-lg border border-accent-blue/20 bg-accent-blue/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 animate-pulse text-accent-blue" />
                    <span className="text-xs font-medium text-text-primary">
                      Analyzing...
                    </span>
                  </div>
                  <span className="text-[10px] text-text-muted">
                    {PHASE_NAMES[progress.phase] ?? progress.phase}
                  </span>
                </div>
                <ProgressBar value={progress.percent} size="sm" showPercent />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Add repo form ────────────────────────────────────── */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3"
            >
              <div className="rounded-lg border border-border-default bg-bg-surface p-4">
                <div className="text-xs font-medium text-text-primary mb-2">
                  Clone &amp; Analyze or Analyze Local
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://github.com/org/repo or /local/path..."
                    value={analyzeInput}
                    onChange={(e) => setAnalyzeInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleCloneAndAnalyze()
                    }
                    className="flex-1 rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none font-mono"
                  />
                  <button
                    onClick={handleCloneAndAnalyze}
                    disabled={!analyzeInput.trim() || isAnalyzing}
                    className="flex items-center gap-1.5 rounded-lg bg-accent-blue px-4 py-2 text-xs font-medium text-white transition hover:bg-accent-blue/90 disabled:opacity-40"
                  >
                    {isAnalyzing ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Zap className="h-3 w-3" />
                    )}
                    Analyze
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-text-muted">
                  Paste a GitHub URL to clone &amp; analyze, or enter a local
                  directory path
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* ── Summary cards ──────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={<Database className="h-4 w-4" />}
            label="Repositories"
            value={String(repos.length)}
            color="blue"
          />
          <SummaryCard
            icon={<FileCode className="h-4 w-4" />}
            label="Total Files"
            value={formatNumber(totalFiles)}
            color="purple"
          />
          <SummaryCard
            icon={<Code2 className="h-4 w-4" />}
            label="Total Functions"
            value={formatNumber(totalFunctions)}
            color="cyan"
          />
          <SummaryCard
            icon={<Layers className="h-4 w-4" />}
            label="Active"
            value={activeRepo ? activeRepo.name.split("/").pop() ?? "—" : "—"}
            color="green"
            truncate
          />
        </div>

        {/* ── Search ─────────────────────────────────────────── */}
        {repos.length > 1 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-bg-surface py-2 pl-9 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
            />
          </div>
        )}

        {/* ── Repo list ──────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-default bg-bg-surface/50 py-16 text-center">
            <Database className="mx-auto h-10 w-10 text-text-muted/30" />
            <p className="mt-3 text-sm text-text-muted">
              No repositories analyzed yet
            </p>
            <p className="mt-1 text-xs text-text-muted/70">
              Click "Add Repository" to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRepos.map((repo, i) => (
              <motion.div
                key={repo.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <RepoCard
                  repo={repo}
                  isDeleteConfirm={deleteConfirm === repo.id}
                  onSwitch={() => handleSwitch(repo)}
                  onReanalyze={() => handleAnalyze(repo.path)}
                  onDeleteRequest={() => setDeleteConfirm(repo.id)}
                  onDeleteConfirm={() => handleDelete(repo.id)}
                  onDeleteCancel={() => setDeleteConfirm(null)}
                  onNavigate={(route) => {
                    // Switch first if not active, then navigate
                    if (!repo.isActive) {
                      api.switchRepo(repo.path).then(() => navigate(route));
                    } else {
                      navigate(route);
                    }
                  }}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Summary card ─────────────────────────────────────────────── */

function SummaryCard({
  icon,
  label,
  value,
  color,
  truncate: trunc,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  truncate?: boolean;
}) {
  const accent =
    color === "blue"
      ? "text-accent-blue bg-accent-blue/8"
      : color === "purple"
        ? "text-accent-purple bg-accent-purple/8"
        : color === "cyan"
          ? "text-accent-cyan bg-accent-cyan/8"
          : "text-accent-green bg-accent-green/8";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-default bg-bg-surface p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-text-muted">
          {label}
        </div>
        <div
          className={`text-base font-semibold text-text-primary ${trunc ? "truncate max-w-[120px]" : ""}`}
          title={trunc ? value : undefined}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

/* ── Repo card ────────────────────────────────────────────────── */

function RepoCard({
  repo,
  isDeleteConfirm,
  onSwitch,
  onReanalyze,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  onNavigate,
}: {
  repo: RepoInfo;
  isDeleteConfirm: boolean;
  onSwitch: () => void;
  onReanalyze: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onNavigate: (route: string) => void;
}) {
  const s = repo.stats;
  const hasData = s && s.nodes > 0;

  return (
    <div
      className={`group rounded-xl border transition-all ${
        repo.isActive
          ? "border-accent-blue/30 bg-accent-blue/[0.03] shadow-[0_0_20px_rgba(59,130,246,0.06)]"
          : "border-border-default bg-bg-surface hover:border-border-default/80 hover:bg-bg-surface/80"
      }`}
    >
      {/* ── Top row: name, badges, actions ── */}
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {repo.isActive && (
              <span className="flex h-2 w-2 rounded-full bg-accent-green shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            )}
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {repo.name}
            </h3>
            {repo.isCloned && (
              <span className="flex items-center gap-1 rounded-full bg-accent-purple/10 px-1.5 py-0.5 text-[9px] font-medium text-accent-purple">
                <Globe className="h-2.5 w-2.5" />
                cloned
              </span>
            )}
            {!hasData && (
              <span className="rounded-full bg-accent-amber/10 px-1.5 py-0.5 text-[9px] font-medium text-accent-amber">
                empty
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-text-muted font-mono">
            <FolderOpen className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{repo.path}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!repo.isActive && (
            <button
              onClick={onSwitch}
              className="rounded-lg border border-border-default bg-bg-elevated px-2.5 py-1 text-[10px] font-medium text-text-secondary transition hover:border-accent-blue hover:text-accent-blue"
              title="Set as active repository"
            >
              Switch
            </button>
          )}
          <button
            onClick={onReanalyze}
            className="rounded-lg border border-border-default bg-bg-elevated p-1.5 text-text-muted transition hover:border-accent-blue hover:text-accent-blue"
            title="Re-analyze"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          {isDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onDeleteConfirm}
                className="rounded-lg bg-accent-red/10 px-2 py-1 text-[10px] font-semibold text-accent-red transition hover:bg-accent-red/20"
              >
                Confirm Delete
              </button>
              <button
                onClick={onDeleteCancel}
                className="rounded-lg bg-bg-elevated px-2 py-1 text-[10px] text-text-muted transition hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={onDeleteRequest}
              className="rounded-lg border border-border-default bg-bg-elevated p-1.5 text-text-muted transition hover:border-accent-red hover:text-accent-red"
              title="Delete analysis data"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Stats row ── */}
      {hasData && (
        <div className="border-t border-border-default/50 px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <StatChip icon={<FileCode className="h-3 w-3" />} label="Files" value={formatNumber(s.files)} />
            <StatChip icon={<Code2 className="h-3 w-3" />} label="Functions" value={formatNumber(s.functions)} />
            <StatChip icon={<Layers className="h-3 w-3" />} label="Classes" value={formatNumber(s.classes)} />
            <StatChip icon={<Network className="h-3 w-3" />} label="Symbols" value={formatNumber(s.nodes)} />
            <StatChip icon={<GitBranch className="h-3 w-3" />} label="Edges" value={formatNumber(s.edges)} />
            {s.languages.length > 0 && (
              <div className="flex items-center gap-1">
                {s.languages.slice(0, 4).map((lang) => (
                  <span
                    key={lang}
                    className="rounded-full bg-bg-elevated px-2 py-0.5 text-[9px] font-medium text-text-secondary"
                  >
                    {lang}
                  </span>
                ))}
                {s.languages.length > 4 && (
                  <span className="text-[9px] text-text-muted">
                    +{s.languages.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Timing info */}
          <div className="mt-2 flex items-center gap-4 text-[10px] text-text-muted">
            {s.analyzedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {formatRelativeTime(s.analyzedAt)}
              </span>
            )}
            {s.duration && (
              <span className="flex items-center gap-1">
                <Zap className="h-2.5 w-2.5" />
                {formatDuration(s.duration)}
              </span>
            )}
            {repo.dbSize > 0 && (
              <span className="flex items-center gap-1">
                <HardDrive className="h-2.5 w-2.5" />
                {formatBytes(repo.dbSize)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Quick actions row ── */}
      {hasData && repo.isActive && (
        <div className="border-t border-border-default/50 px-5 py-2.5 flex items-center gap-1.5 overflow-x-auto">
          <QuickAction label="Trace" onClick={() => onNavigate(ROUTES.trace)} />
          <QuickAction label="Schema" onClick={() => onNavigate(ROUTES.schema)} />
          <QuickAction label="Security" onClick={() => onNavigate(ROUTES.security)} />
          <QuickAction label="Graph" onClick={() => onNavigate(ROUTES.graph)} />
          <QuickAction label="Risk" onClick={() => onNavigate(ROUTES.risk)} />
          <QuickAction label="Tests" onClick={() => onNavigate(ROUTES.tests)} />
          <QuickAction label="Branches" onClick={() => onNavigate(ROUTES.branches)} />
        </div>
      )}
    </div>
  );
}

/* ── Stat chip ────────────────────────────────────────────────── */

function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className="text-text-muted">{icon}</span>
      <span className="text-text-muted">{label}</span>
      <span className="font-semibold text-text-primary">{value}</span>
    </div>
  );
}

/* ── Quick action pill ────────────────────────────────────────── */

function QuickAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-md border border-border-default bg-bg-elevated px-2.5 py-1 text-[10px] font-medium text-text-secondary transition hover:border-accent-blue/40 hover:text-accent-blue whitespace-nowrap"
    >
      {label}
      <ChevronRight className="h-2.5 w-2.5" />
    </button>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
