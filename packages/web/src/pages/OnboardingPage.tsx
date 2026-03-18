import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GitBranch,
  Search,
  Shield,
  Cpu,
  Database,
  ArrowRight,
  FolderOpen,
  Zap,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useAnalysisStore } from "@/stores/analysis-store";
import { PAGE_VARIANTS, ROUTES } from "@/lib/constants";

const features = [
  {
    icon: Search,
    title: "Data-Flow Tracing",
    description:
      "Trace any variable through your codebase — across calls, modules, and transforms.",
    color: "#3b82f6",
  },
  {
    icon: GitBranch,
    title: "Branch Conflict Prediction",
    description:
      "Detect semantic merge conflicts before they happen across active branches.",
    color: "#10b981",
  },
  {
    icon: Shield,
    title: "Security Taint Analysis",
    description:
      "Track untrusted data from sources to sinks. Find injection vulnerabilities automatically.",
    color: "#ef4444",
  },
  {
    icon: Database,
    title: "Schema Impact Analysis",
    description:
      "Understand how database schema changes ripple through your application code.",
    color: "#8b5cf6",
  },
  {
    icon: Zap,
    title: "Test Impact Analysis",
    description:
      "Know exactly which tests to run based on your code changes. Find coverage gaps.",
    color: "#f59e0b",
  },
  {
    icon: Cpu,
    title: "Risk Assessment",
    description:
      "Composite risk scoring combining complexity, coupling, test coverage, and change velocity.",
    color: "#ec4899",
  },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { repoPath, setRepoPath, setDbPath } = useAppStore();
  const { startAnalysis } = useAnalysis();
  const isAnalyzing = useAnalysisStore((s) => s.isRunning);
  const [inputPath, setInputPath] = useState(repoPath ?? "");
  const [isCloning, setIsCloning] = useState(false);

  const isGitHubUrl = (input: string) =>
    /^https:\/\/github\.com\/.+\/.+/.test(input.trim()) ||
    /^git@github\.com:.+\/.+/.test(input.trim());

  const handleStart = async () => {
    const trimmed = inputPath.trim();
    if (!trimmed) return;

    let localPath = trimmed;

    // If it's a GitHub URL, clone first
    if (isGitHubUrl(trimmed)) {
      setIsCloning(true);
      try {
        const result = await api.cloneRepo(trimmed);
        localPath = result.data.repoPath;
        toast.success(
          result.data.alreadyCloned ? "Repository updated" : "Repository cloned",
          { description: localPath }
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

    setRepoPath(localPath);
    setDbPath(`${localPath}/.codeflow/analysis.db`);

    await startAnalysis();
    navigate(ROUTES.dashboard);
  };

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex h-full items-center justify-center p-8"
    >
      <div className="w-full max-w-4xl space-y-12">
        {/* Hero */}
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-surface px-4 py-1.5"
          >
            <div className="h-2 w-2 rounded-full bg-accent-green animate-pulse" />
            <span className="text-sm text-text-secondary">
              Data-Aware Code Intelligence
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="text-5xl font-bold tracking-tight"
          >
            <span className="bg-gradient-to-r from-accent-blue via-accent-purple to-accent-pink bg-clip-text text-transparent">
              CodeFlow
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mx-auto mt-4 max-w-lg text-lg text-text-secondary"
          >
            Understand how data moves through your code. Predict conflicts,
            trace flows, assess risk — all from static analysis.
          </motion.p>
        </div>

        {/* Repository input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mx-auto max-w-lg"
        >
          <div className="flex items-center gap-3 rounded-xl border border-border-default bg-bg-surface p-2">
            <FolderOpen className="ml-2 h-5 w-5 text-text-muted" />
            <input
              type="text"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="https://github.com/org/repo  or  /path/to/local/repo"
              className="flex-1 bg-transparent py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            <button
              onClick={handleStart}
              disabled={!inputPath.trim() || isAnalyzing || isCloning}
              className="flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white transition-all hover:bg-accent-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCloning ? (
                <>
                  <Globe className="h-4 w-4 animate-spin" />
                  Cloning...
                </>
              ) : isAnalyzing ? (
                <>
                  <Cpu className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Analyze
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
              className="group rounded-xl border border-border-default bg-bg-surface p-5 transition-all hover:border-border-focus hover:bg-bg-elevated/30"
            >
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${feature.color}15` }}
              >
                <feature.icon
                  className="h-5 w-5"
                  style={{ color: feature.color }}
                />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">
                {feature.title}
              </h3>
              <p className="mt-1 text-xs text-text-muted leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
