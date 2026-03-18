import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useBranchStore } from "@/stores/branch-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useSSE } from "./useSSE";
import type { BranchConflict } from "@/types/branch";

export function useBranches() {
  const { setBranches, setConflicts, setLoading, filterSeverity } =
    useBranchStore();

  const { autoScan, scanInterval, minSeverity } = useSettingsStore(
    (s) => s.branches,
  );

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getBranches();
      setBranches(response.data.branches as never[]);
    } catch (error) {
      toast.error("Failed to fetch branches", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [setBranches, setLoading]);

  const fetchConflicts = useCallback(async () => {
    try {
      const severity = filterSeverity ?? minSeverity;
      const response = await api.getConflicts(severity);
      setConflicts(response.data.conflicts as BranchConflict[]);
    } catch (error) {
      toast.error("Failed to fetch conflicts", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [setConflicts, filterSeverity, minSeverity]);

  const prePushCheck = useCallback(async (branch: string) => {
    try {
      const response = await api.prePush(branch);
      return response.data;
    } catch (error) {
      toast.error("Pre-push check failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }, []);

  // Auto-scan with SSE
  useSSE("branch-conflict", (data) => {
    if (data?.conflict) {
      const conflict = data.conflict as BranchConflict;
      toast.warning(`New conflict: ${conflict.branch1} ↔ ${conflict.branch2}`, {
        description: `${conflict.severity} severity — ${conflict.level} level`,
      });
      fetchConflicts();
    }
  });

  // Polling interval
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => {
    if (autoScan && scanInterval > 0) {
      intervalRef.current = setInterval(fetchConflicts, scanInterval);
      return () => clearInterval(intervalRef.current);
    }
  }, [autoScan, scanInterval, fetchConflicts]);

  return { fetchBranches, fetchConflicts, prePushCheck };
}
