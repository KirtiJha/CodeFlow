import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  activePanels: Record<string, boolean>;
  theme: "dark";
  splitSizes: Record<string, number[]>;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  togglePanel: (panelId: string) => void;
  setPanelVisible: (panelId: string, visible: boolean) => void;
  setSplitSizes: (splitId: string, sizes: number[]) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  activePanels: {
    detail: true,
    minimap: true,
    legend: true,
  },
  theme: "dark",
  splitSizes: {},

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  togglePanel: (panelId) =>
    set((state) => ({
      activePanels: {
        ...state.activePanels,
        [panelId]: !state.activePanels[panelId],
      },
    })),
  setPanelVisible: (panelId, visible) =>
    set((state) => ({
      activePanels: { ...state.activePanels, [panelId]: visible },
    })),
  setSplitSizes: (splitId, sizes) =>
    set((state) => ({
      splitSizes: { ...state.splitSizes, [splitId]: sizes },
    })),
}));
