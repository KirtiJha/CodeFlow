import { create } from "zustand";
import type {
  SecurityReport,
  TaintFlow,
  SecurityScore,
} from "@/types/security";

interface SecurityState {
  report: SecurityReport | null;
  score: SecurityScore | null;
  selectedFlow: TaintFlow | null;
  isScanning: boolean;
  filterSeverity: string | null;
  filterCategory: string | null;

  setReport: (report: SecurityReport | null) => void;
  setScore: (score: SecurityScore) => void;
  selectFlow: (flow: TaintFlow | null) => void;
  setScanning: (scanning: boolean) => void;
  setFilterSeverity: (severity: string | null) => void;
  setFilterCategory: (category: string | null) => void;
  reset: () => void;
}

export const useSecurityStore = create<SecurityState>((set) => ({
  report: null,
  score: null,
  selectedFlow: null,
  isScanning: false,
  filterSeverity: null,
  filterCategory: null,

  setReport: (report) => set({ report }),
  setScore: (score) => set({ score }),
  selectFlow: (flow) => set({ selectedFlow: flow }),
  setScanning: (scanning) => set({ isScanning: scanning }),
  setFilterSeverity: (severity) => set({ filterSeverity: severity }),
  setFilterCategory: (category) => set({ filterCategory: category }),
  reset: () =>
    set({
      report: null,
      score: null,
      selectedFlow: null,
      filterSeverity: null,
      filterCategory: null,
    }),
}));
