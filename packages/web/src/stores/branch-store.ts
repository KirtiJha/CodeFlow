import { create } from "zustand";
import type { BranchInfo, BranchConflict, BranchMatrix } from "@/types/branch";

interface BranchState {
  branches: BranchInfo[];
  conflicts: BranchConflict[];
  matrix: BranchMatrix | null;
  selectedBranch: string | null;
  selectedConflict: BranchConflict | null;
  isLoading: boolean;
  filterSeverity: string | null;

  setBranches: (branches: BranchInfo[]) => void;
  setConflicts: (conflicts: BranchConflict[]) => void;
  setMatrix: (matrix: BranchMatrix) => void;
  selectBranch: (branch: string | null) => void;
  selectConflict: (conflict: BranchConflict | null) => void;
  setLoading: (loading: boolean) => void;
  setFilterSeverity: (severity: string | null) => void;
  reset: () => void;
}

export const useBranchStore = create<BranchState>((set) => ({
  branches: [],
  conflicts: [],
  matrix: null,
  selectedBranch: null,
  selectedConflict: null,
  isLoading: false,
  filterSeverity: null,

  setBranches: (branches) => set({ branches }),
  setConflicts: (conflicts) => set({ conflicts }),
  setMatrix: (matrix) => set({ matrix }),
  selectBranch: (branch) => set({ selectedBranch: branch }),
  selectConflict: (conflict) => set({ selectedConflict: conflict }),
  setLoading: (loading) => set({ isLoading: loading }),
  setFilterSeverity: (severity) => set({ filterSeverity: severity }),
  reset: () =>
    set({
      branches: [],
      conflicts: [],
      matrix: null,
      selectedBranch: null,
      selectedConflict: null,
      filterSeverity: null,
    }),
}));
