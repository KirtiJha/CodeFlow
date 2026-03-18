import { create } from "zustand";
import type {
  AnalysisJob,
  AnalysisStats,
  PipelineProgress,
} from "@/types/analysis";

interface AnalysisState {
  currentJob: AnalysisJob | null;
  progress: PipelineProgress | null;
  stats: AnalysisStats | null;
  isRunning: boolean;
  history: AnalysisJob[];

  setCurrentJob: (job: AnalysisJob | null) => void;
  updateProgress: (progress: PipelineProgress) => void;
  setStats: (stats: AnalysisStats) => void;
  setRunning: (running: boolean) => void;
  addToHistory: (job: AnalysisJob) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  currentJob: null,
  progress: null,
  stats: null,
  isRunning: false,
  history: [],

  setCurrentJob: (job) => set({ currentJob: job }),
  updateProgress: (progress) => set({ progress }),
  setStats: (stats) => set({ stats }),
  setRunning: (running) => set({ isRunning: running }),
  addToHistory: (job) =>
    set((state) => ({ history: [job, ...state.history].slice(0, 50) })),
  reset: () =>
    set({ currentJob: null, progress: null, stats: null, isRunning: false }),
}));
