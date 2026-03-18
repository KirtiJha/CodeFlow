import { create } from "zustand";
import type { TestImpactResult, TestInfo, TestGap } from "@/types/api";

interface TestState {
  impactResult: TestImpactResult | null;
  selectedTest: TestInfo | null;
  gaps: TestGap[];
  isLoading: boolean;
  changedFiles: string[];

  setImpactResult: (result: TestImpactResult | null) => void;
  selectTest: (test: TestInfo | null) => void;
  setGaps: (gaps: TestGap[]) => void;
  setLoading: (loading: boolean) => void;
  setChangedFiles: (files: string[]) => void;
  reset: () => void;
}

export const useTestStore = create<TestState>((set) => ({
  impactResult: null,
  selectedTest: null,
  gaps: [],
  isLoading: false,
  changedFiles: [],

  setImpactResult: (result) => set({ impactResult: result }),
  selectTest: (test) => set({ selectedTest: test }),
  setGaps: (gaps) => set({ gaps }),
  setLoading: (loading) => set({ isLoading: loading }),
  setChangedFiles: (files) => set({ changedFiles: files }),
  reset: () =>
    set({
      impactResult: null,
      selectedTest: null,
      gaps: [],
      changedFiles: [],
    }),
}));
