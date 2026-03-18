import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUIStore } from "@/stores/ui-store";
import { SHORTCUTS, ROUTES } from "@/lib/constants";

export function useKeyboard() {
  const navigate = useNavigate();
  const { toggleSidebar, setCommandPaletteOpen } = useUIStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+K — Command palette
      if (meta && e.key === SHORTCUTS.commandPalette.key) {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Cmd+B — Toggle sidebar
      if (meta && e.key === SHORTCUTS.toggleSidebar.key) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Cmd+1..6 — Navigate pages
      if (meta && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const pages = [
          ROUTES.dashboard,
          ROUTES.trace,
          ROUTES.branches,
          ROUTES.tests,
          ROUTES.security,
          ROUTES.graph,
          ROUTES.schema,
          ROUTES.risk,
          ROUTES.settings,
        ];
        const idx = parseInt(e.key) - 1;
        if (idx < pages.length) {
          navigate(pages[idx]);
        }
        return;
      }

      // / — Focus search (when not in input)
      if (
        e.key === "/" &&
        !meta &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Escape — Close open panel
      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    },
    [navigate, toggleSidebar, setCommandPaletteOpen],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
