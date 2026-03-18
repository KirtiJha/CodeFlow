import { useAppStore } from "@/stores/app-store";
import { useAnalysisStore } from "@/stores/analysis-store";
import { formatNumber } from "@/lib/formatters";
import { Database, GitBranch, Cpu } from "lucide-react";

export function StatusBar() {
  const { repoPath, isConnected } = useAppStore();
  const { stats, isRunning, progress } = useAnalysisStore();

  return (
    <footer className="flex h-6 items-center justify-between border-t border-border-default bg-bg-surface/80 px-3 text-[10px] font-medium text-text-muted">
      <div className="flex items-center gap-4">
        {/* Connection indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isConnected ? "bg-green-400" : "bg-red-400"
            }`}
          />
          {isConnected ? "Connected" : "Disconnected"}
        </div>

        {/* Repo path */}
        {repoPath && (
          <div className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            <span className="max-w-48 truncate">{repoPath}</span>
          </div>
        )}

        {/* Analysis progress */}
        {isRunning && progress && (
          <div className="flex items-center gap-1">
            <Cpu className="h-3 w-3 animate-pulse text-accent-blue" />
            <span className="text-accent-blue">
              {progress.phase} ({Math.round(progress.percent)}%)
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Stats */}
        {stats && (
          <>
            <div className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              {formatNumber(stats.totalNodes)} nodes
            </div>
            <div className="flex items-center gap-1">
              {formatNumber(stats.totalFiles)} files
            </div>
          </>
        )}

        <span>CodeFlow v0.1.0</span>
      </div>
    </footer>
  );
}
