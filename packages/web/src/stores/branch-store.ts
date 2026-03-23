import { create } from "zustand";
import type { BranchInfo, BranchConflict, BranchMatrix, BranchScanEntry, BranchDiffResult, PrePushResult } from "@/types/branch";

interface BranchState {
  branches: BranchInfo[];
  conflicts: BranchConflict[];
  scanEntries: BranchScanEntry[];
  matrix: BranchMatrix | null;
  selectedBranch: string | null;
  selectedConflict: BranchConflict | null;
  diffResult: BranchDiffResult | null;
  prePushResult: PrePushResult | null;
  isLoading: boolean;
  filterSeverity: string | null;

  setBranches: (branches: BranchInfo[]) => void;
  setConflicts: (conflicts: BranchConflict[]) => void;
  setScanEntries: (entries: BranchScanEntry[]) => void;
  setMatrix: (matrix: BranchMatrix) => void;
  selectBranch: (branch: string | null) => void;
  selectConflict: (conflict: BranchConflict | null) => void;
  setDiffResult: (result: BranchDiffResult | null) => void;
  setPrePushResult: (result: PrePushResult | null) => void;
  setLoading: (loading: boolean) => void;
  setFilterSeverity: (severity: string | null) => void;
  reset: () => void;
}

export const useBranchStore = create<BranchState>((set) => ({
  branches: [],
  conflicts: [],
  scanEntries: [],
  matrix: null,
  selectedBranch: null,
  selectedConflict: null,
  diffResult: null,
  prePushResult: null,
  isLoading: false,
  filterSeverity: null,

  setBranches: (branches) => set({ branches }),
  setConflicts: (conflicts) => set({ conflicts }),
  setScanEntries: (entries) => set({ scanEntries: entries }),
  setMatrix: (matrix) => set({ matrix }),
  selectBranch: (branch) => set({ selectedBranch: branch }),
  selectConflict: (conflict) => set({ selectedConflict: conflict }),
  setDiffResult: (result) => set({ diffResult: result }),
  setPrePushResult: (result) => set({ prePushResult: result }),
  setLoading: (loading) => set({ isLoading: loading }),
  setFilterSeverity: (severity) => set({ filterSeverity: severity }),
  reset: () =>
    set({
      branches: [],
      conflicts: [],
      scanEntries: [],
      matrix: null,
      selectedBranch: null,
      selectedConflict: null,
      diffResult: null,
      prePushResult: null,
      filterSeverity: null,
    }),
}));
