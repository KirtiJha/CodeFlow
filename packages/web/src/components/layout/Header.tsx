import { useLocation } from "react-router-dom";
import { Search, Command, Wifi, WifiOff } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useAppStore } from "@/stores/app-store";
import { useAnalysisStore } from "@/stores/analysis-store";
import { ROUTES } from "@/lib/constants";

const PAGE_TITLES: Record<string, string> = {
  [ROUTES.onboarding]: "",
  [ROUTES.dashboard]: "Dashboard",
  [ROUTES.trace]: "Data Flow Trace",
  [ROUTES.branches]: "Branch Conflicts",
  [ROUTES.tests]: "Test Impact",
  [ROUTES.security]: "Security Analysis",
  [ROUTES.schema]: "Schema Impact",
  [ROUTES.risk]: "Risk Assessment",
  [ROUTES.graph]: "Graph Explorer",
  [ROUTES.settings]: "Settings",
};

export function Header() {
  const location = useLocation();
  const { setCommandPaletteOpen } = useUIStore();
  const { isConnected } = useAppStore();
  const { isRunning, progress } = useAnalysisStore();

  const title = PAGE_TITLES[location.pathname] ?? "CodeFlow";

  return (
    <header className="flex h-12 items-center justify-between border-b border-border-default bg-bg-surface/80 px-4 backdrop-blur-md">
      {/* Page title */}
      <h1 className="text-sm font-semibold text-text-primary">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Analysis progress */}
        {isRunning && progress && (
          <div className="flex items-center gap-2 rounded-lg bg-accent-blue/10 px-3 py-1">
            <div className="h-2 w-2 animate-pulse rounded-full bg-accent-blue" />
            <span className="text-xs font-medium text-accent-blue">
              {progress.phase} — {Math.round(progress.percent)}%
            </span>
          </div>
        )}

        {/* Search button */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-elevated/50 px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-border-focus hover:text-text-secondary"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search…</span>
          <kbd className="ml-4 flex items-center gap-0.5 rounded border border-border-default bg-bg-surface px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        {/* Connection status */}
        <div
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${
            isConnected ? "text-green-400" : "text-text-muted"
          }`}
        >
          {isConnected ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )}
        </div>
      </div>
    </header>
  );
}
