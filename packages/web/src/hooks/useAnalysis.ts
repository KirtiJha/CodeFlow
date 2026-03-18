import { useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";
import { useAnalysisStore } from "@/stores/analysis-store";


export function useAnalysis() {
  const { setCurrentJob, updateProgress, setRunning, addToHistory } =
    useAnalysisStore();

  const startAnalysis = useCallback(async () => {
    // Read fresh from store to avoid stale closure after setRepoPath()
    const currentRepoPath = useAppStore.getState().repoPath;
    if (!currentRepoPath) {
      toast.error("No repository selected");
      return;
    }

    setRunning(true);
    try {
      const response = await api.startAnalysis(currentRepoPath);
      const jobId = response.data.jobId;
      setCurrentJob({
        id: jobId,
        status: "running",
        progress: 0,
        phase: "parsing",
        startedAt: new Date().toISOString(),
      });

      toast.info("Analysis started", {
        description: `Job ${jobId.slice(0, 8)}`,
      });
      pollJobStatus(jobId);
    } catch (error) {
      setRunning(false);
      toast.error("Failed to start analysis", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [setCurrentJob, setRunning]);

  const pollJobStatus = useCallback(
    async (jobId: string) => {
      const poll = async () => {
        try {
          const response = await api.getJobStatus(jobId);
          const { status, progress, phase } = response.data;

          updateProgress({
            phase,
            phaseIndex: 0,
            totalPhases: 12,
            current: 0,
            total: 0,
            percent: progress,
          });

          if (status === "completed") {
            setRunning(false);
            const statusResponse = await api.getStatus();
            const job = {
              id: jobId,
              status: "completed" as const,
              progress: 100,
              phase: "done",
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
            };
            setCurrentJob(job);
            addToHistory(job);
            toast.success("Analysis complete", {
              description: `${Object.values(statusResponse.data.stats).reduce((a, b) => a + b, 0)} items indexed`,
            });
            return;
          }

          if (status === "failed") {
            setRunning(false);
            toast.error("Analysis failed");
            return;
          }

          setTimeout(poll, 1000);
        } catch (err) {
          setRunning(false);
          const msg = err instanceof Error ? err.message : "Unknown error";
          toast.error("Lost connection to server", {
            description: msg,
          });
        }
      };

      poll();
    },
    [updateProgress, setRunning, setCurrentJob, addToHistory],
  );

  return { startAnalysis };
}
