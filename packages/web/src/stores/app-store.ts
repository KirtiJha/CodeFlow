import { create } from "zustand";

interface AppState {
  repoPath: string | null;
  dbPath: string | null;
  serverUrl: string;
  isConnected: boolean;
  isAnalyzed: boolean;
  error: string | null;

  setRepoPath: (path: string) => void;
  setDbPath: (path: string) => void;
  setServerUrl: (url: string) => void;
  setConnected: (connected: boolean) => void;
  setAnalyzed: (analyzed: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  repoPath: null,
  dbPath: null,
  serverUrl: "/api",
  isConnected: false,
  isAnalyzed: false,
  error: null,

  setRepoPath: (path) => set({ repoPath: path }),
  setDbPath: (path) => set({ dbPath: path }),
  setServerUrl: (url) => set({ serverUrl: url }),
  setConnected: (connected) => set({ isConnected: connected }),
  setAnalyzed: (analyzed) => set({ isAnalyzed: analyzed }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      repoPath: null,
      dbPath: null,
      isConnected: false,
      isAnalyzed: false,
      error: null,
    }),
}));
