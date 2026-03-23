import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useBranchStore } from "@/stores/branch-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useSSE } from "./useSSE";
import type { BranchInfo, BranchScanEntry, BranchDiffResult, PrePushResult } from "@/types/branch";

export function useBranches() {
  const { setBranches, setScanEntries, setDiffResult, setPrePushResult, setLoading, filterSeverity } =
    useBranchStore();

  const { autoScan, scanInterval, minSeverity } = useSettingsStore(
    (s) => s.branches,
  );

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getBranches();
      const data = response.data as { branches?: BranchInfo[] };
      setBranches(data?.branches ?? []);
    } catch (error) {
      toast.error("Failed to fetch branches", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [setBranches, setLoading]);

  const fetchScanEntries = useCallback(async () => {
    try {
      const severity = filterSeverity ?? minSeverity;
      const response = await api.getConflicts(severity);
      const data = response.data as { branchCount?: number; branches?: BranchScanEntry[] };
      setScanEntries(data?.branches ?? []);
    } catch {
      // Silently handle — scan may fail for repos without remotes
      setScanEntries([]);
    }
  }, [setScanEntries, filterSeverity, minSeverity]);

  const diffBranches = useCallback(async (branchA: string, branchB: string) => {
    try {
      const response = await api.diffBranches(branchA, branchB);
      const data = response.data as BranchDiffResult;
      setDiffResult(data ?? null);
      return data;
    } catch (error) {
      toast.error("Failed to diff branches", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      setDiffResult(null);
      return null;
    }
  }, [setDiffResult]);

  const prePushCheck = useCallback(async (branch: string) => {
    try {
      const response = await api.prePush(branch);
      const data = response.data as PrePushResult;
      setPrePushResult(data ?? null);
      return data;
    } catch (error) {
      toast.error("Pre-push check failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      setPrePushResult(null);
      return null;
    }
  }, [setPrePushResult]);

  // Auto-scan with SSE
  useSSE("branch-conflict", (data) => {
    if (data?.conflict) {
      toast.warning(`Branch update detected`, {
        description: "Refreshing branch data...",
      });
      fetchBranches();
    }
  });

  // Polling interval
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => {
    if (autoScan && scanInterval > 0) {
      intervalRef.current = setInterval(fetchBranches, scanInterval);
      return () => clearInterval(intervalRef.current);
    }
  }, [autoScan, scanInterval, fetchBranches]);

  return { fetchBranches, fetchScanEntries, diffBranches, prePushCheck };
}
