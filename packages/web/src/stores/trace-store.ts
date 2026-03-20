import { create } from "zustand";
import type { TraceResult, TraceQuery, TraceNode } from "@/types/trace";

interface TraceState {
  result: TraceResult | null;
  query: TraceQuery | null;
  selectedNode: TraceNode | null;
  isTracing: boolean;
  history: TraceQuery[];

  setResult: (result: TraceResult | null) => void;
  setQuery: (query: TraceQuery) => void;
  selectNode: (node: TraceNode | null) => void;
  setTracing: (tracing: boolean) => void;
  addToHistory: (query: TraceQuery) => void;
  reset: () => void;
}

export const useTraceStore = create<TraceState>((set) => ({
  result: null,
  query: null,
  selectedNode: null,
  isTracing: false,
  history: [],

  setResult: (result) => set({ result }),
  setQuery: (query) => set({ query }),
  selectNode: (node) => set({ selectedNode: node }),
  setTracing: (tracing) => set({ isTracing: tracing }),
  addToHistory: (query) =>
    set((state) => {
      const keyOf = (q: TraceQuery) =>
        [
          q.mode,
          q.sessionId ?? "",
          q.symbol ?? "",
          q.direction,
          q.depth,
          q.includeTests ? "1" : "0",
          q.observedOnly ? "1" : "0",
          (q.edgeKinds ?? []).slice().sort().join("|"),
        ].join("::");

      const queryKey = keyOf(query);
      const deduped = state.history.filter((h) => keyOf(h) !== queryKey);
      return { history: [query, ...deduped].slice(0, 20) };
    }),
  reset: () =>
    set({ result: null, query: null, selectedNode: null, isTracing: false }),
}));
