import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  analysis: {
    excludePatterns: string[];
    languages: string[];
    maxFileSize: number;
    workerCount: number;
  };
  branches: {
    autoScan: boolean;
    scanInterval: number;
    minSeverity: string;
    maxBranches: number;
  };
  security: {
    enableTaintAnalysis: boolean;
    customSources: string[];
    customSinks: string[];
    ignoredPaths: string[];
  };
  display: {
    graphLayout: "force" | "circular" | "tree";
    maxGraphNodes: number;
    codeTheme: string;
    showLineNumbers: boolean;
  };

  updateAnalysis: (settings: Partial<SettingsState["analysis"]>) => void;
  updateBranches: (settings: Partial<SettingsState["branches"]>) => void;
  updateSecurity: (settings: Partial<SettingsState["security"]>) => void;
  updateDisplay: (settings: Partial<SettingsState["display"]>) => void;
  resetToDefaults: () => void;
}

const defaults = {
  analysis: {
    excludePatterns: ["node_modules", "dist", ".git", "vendor", "build"],
    languages: [],
    maxFileSize: 524288,
    workerCount: 4,
  },
  branches: {
    autoScan: true,
    scanInterval: 300000,
    minSeverity: "low",
    maxBranches: 20,
  },
  security: {
    enableTaintAnalysis: true,
    customSources: [],
    customSinks: [],
    ignoredPaths: [],
  },
  display: {
    graphLayout: "force" as const,
    maxGraphNodes: 5000,
    codeTheme: "github-dark",
    showLineNumbers: true,
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,

      updateAnalysis: (settings) =>
        set((state) => ({
          analysis: { ...state.analysis, ...settings },
        })),
      updateBranches: (settings) =>
        set((state) => ({
          branches: { ...state.branches, ...settings },
        })),
      updateSecurity: (settings) =>
        set((state) => ({
          security: { ...state.security, ...settings },
        })),
      updateDisplay: (settings) =>
        set((state) => ({
          display: { ...state.display, ...settings },
        })),
      resetToDefaults: () => set(defaults),
    }),
    { name: "codeflow-settings" },
  ),
);
