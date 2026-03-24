import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import * as Tabs from "@radix-ui/react-tabs";
import {
  ArrowRight,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { GitHubIcon } from "@/components/shared/GitHubIcon";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useAnalysisStore } from "@/stores/analysis-store";
import { PAGE_VARIANTS, ROUTES } from "@/lib/constants";
import { CodeFlowLogo } from "@/components/shared/CodeFlowLogo";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { repoPath, setRepoPath, setDbPath } = useAppStore();
  const { startAnalysis } = useAnalysis();
  const isAnalyzing = useAnalysisStore((s) => s.isRunning);
  const [localPath, setLocalPath] = useState(repoPath ?? "");
  const [githubUrl, setGithubUrl] = useState("");
  const [activeTab, setActiveTab] = useState<string>("local");
  const [isCloning, setIsCloning] = useState(false);

  const isBusy = isAnalyzing || isCloning;
  const currentInput = activeTab === "local" ? localPath.trim() : githubUrl.trim();

  const handleAnalyze = async () => {
    if (!currentInput || isBusy) return;

    let resolvedPath = currentInput;

    if (activeTab === "github") {
      setIsCloning(true);
      try {
        const result = await api.cloneRepo(currentInput);
        resolvedPath = result.data.repoPath;
        toast.success(
          result.data.alreadyCloned ? "Repository ready" : "Repository cloned",
          { description: resolvedPath },
        );
      } catch (error) {
        setIsCloning(false);
        toast.error("Failed to clone repository", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        return;
      }
      setIsCloning(false);
    }

    setRepoPath(resolvedPath);
    setDbPath(`${resolvedPath}/.codeflow/analysis.db`);

    await startAnalysis();
    navigate(ROUTES.dashboard);
  };

  const buttonLabel = isCloning
    ? "Cloning…"
    : isAnalyzing
      ? "Analyzing…"
      : "Analyze";

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex h-full items-center justify-center"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-10 px-6">
        {/* Logo + Wordmark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-4"
        >
          <CodeFlowLogo size={56} />
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-accent-blue via-accent-purple to-accent-pink bg-clip-text text-transparent">
              CodeFlow
            </span>
          </h1>
          <p className="text-center text-sm leading-relaxed text-text-secondary">
            Understand how data moves through your code.
            <br />
            Trace flows. Detect vulnerabilities. Assess risk.
          </p>
        </motion.div>

        {/* Tabbed input card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="w-full"
        >
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List className="mb-4 flex rounded-lg border border-border-default bg-bg-surface p-1">
              <Tabs.Trigger
                value="local"
                className="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-text-muted transition-colors data-[state=active]:bg-bg-elevated data-[state=active]:text-text-primary"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Local Path
              </Tabs.Trigger>
              <Tabs.Trigger
                value="github"
                className="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-text-muted transition-colors data-[state=active]:bg-bg-elevated data-[state=active]:text-text-primary"
              >
                <GitHubIcon className="h-3.5 w-3.5" />
                GitHub
              </Tabs.Trigger>
            </Tabs.List>

            <div className="rounded-xl border border-border-default bg-bg-surface p-4">
              <Tabs.Content value="local" className="space-y-3">
                <label className="block text-xs font-medium text-text-secondary">
                  Repository path
                </label>
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  placeholder="/home/user/my-project"
                  className="w-full rounded-lg border border-border-default bg-bg-base px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue/30 transition-colors"
                />
              </Tabs.Content>

              <Tabs.Content value="github" className="space-y-3">
                <label className="block text-xs font-medium text-text-secondary">
                  Repository URL
                </label>
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  placeholder="https://github.com/org/repo"
                  className="w-full rounded-lg border border-border-default bg-bg-base px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue/30 transition-colors"
                />
              </Tabs.Content>

              <button
                onClick={handleAnalyze}
                disabled={!currentInput || isBusy}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-blue py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {buttonLabel}
              </button>
            </div>
          </Tabs.Root>
        </motion.div>
      </div>
    </motion.div>
  );
}
