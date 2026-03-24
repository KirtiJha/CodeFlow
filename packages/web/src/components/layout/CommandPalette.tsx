import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  LayoutDashboard,
  GitFork,
  GitBranch,
  TestTube2,
  Shield,
  Database,
  AlertTriangle,
  Network,
  Settings,
  FileCode,
  ArrowRight,
} from "lucide-react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { useSearch } from "@/hooks/useSearch";
import { ROUTES } from "@/lib/constants";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const pageCommands = [
  {
    id: "dashboard",
    label: "Go to Dashboard",
    icon: LayoutDashboard,
    route: ROUTES.dashboard,
  },
  { id: "trace", label: "Go to Trace", icon: GitFork, route: ROUTES.trace },
  {
    id: "branches",
    label: "Go to Branches",
    icon: GitBranch,
    route: ROUTES.branches,
  },
  { id: "tests", label: "Go to Tests", icon: TestTube2, route: ROUTES.tests },
  {
    id: "security",
    label: "Go to Security",
    icon: Shield,
    route: ROUTES.security,
  },
  { id: "schema", label: "Go to Schema", icon: Database, route: ROUTES.schema },
  { id: "risk", label: "Go to Risk", icon: AlertTriangle, route: ROUTES.risk },
  { id: "graph", label: "Go to Graph", icon: Network, route: ROUTES.graph },
  {
    id: "settings",
    label: "Go to Settings",
    icon: Settings,
    route: ROUTES.settings,
  },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, results, isSearching, search, clear } = useSearch({
    debounceMs: 150,
    limit: 10,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = query
    ? pageCommands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()),
      )
    : pageCommands;

  const allItems = [
    ...filteredCommands.map((c) => ({ type: "command" as const, ...c })),
    ...results.map((r) => ({ type: "result" as const, ...r })),
  ];

  useEffect(() => {
    if (open) {
      setSelectedIndex(0);
      clear();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, clear]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeItem = useCallback(
    (index: number) => {
      const item = allItems[index];
      if (!item) return;

      if (item.type === "command") {
        navigate(item.route);
      } else if (item.type === "result") {
        // Navigate to trace page with this symbol's file as context
        navigate(`${ROUTES.trace}?file=${encodeURIComponent(item.file)}&symbol=${encodeURIComponent(item.name)}`);
      }
      onOpenChange(false);
    },
    [allItems, navigate, onOpenChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        executeItem(selectedIndex);
      }
    },
    [allItems.length, selectedIndex, executeItem],
  );

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              />
            </RadixDialog.Overlay>

            <RadixDialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border-default bg-bg-surface shadow-2xl"
              >
                {/* Search input */}
                <div className="flex items-center gap-3 border-b border-border-default px-4 py-3">
                  <Search className="h-4.5 w-4.5 text-text-muted" />
                  <RadixDialog.Title className="sr-only">
                    Command Palette
                  </RadixDialog.Title>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => search(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search symbols, files, or type a command…"
                    className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
                  />
                  {isSearching && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
                  )}
                </div>

                {/* Results */}
                <div className="max-h-80 overflow-y-auto p-2">
                  {filteredCommands.length > 0 && (
                    <div className="mb-2">
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Pages
                      </p>
                      {filteredCommands.map((cmd, i) => (
                        <button
                          key={cmd.id}
                          onClick={() => executeItem(i)}
                          onMouseEnter={() => setSelectedIndex(i)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                            selectedIndex === i
                              ? "bg-accent-blue/10 text-text-primary"
                              : "text-text-secondary hover:bg-bg-elevated"
                          }`}
                        >
                          <cmd.icon className="h-4 w-4" />
                          <span className="flex-1 text-left">{cmd.label}</span>
                          {selectedIndex === i && (
                            <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {results.length > 0 && (
                    <div>
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Symbols
                      </p>
                      {results.map((result, i) => {
                        const idx = filteredCommands.length + i;
                        return (
                          <button
                            key={result.id}
                            onClick={() => executeItem(idx)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                              selectedIndex === idx
                                ? "bg-accent-blue/10 text-text-primary"
                                : "text-text-secondary hover:bg-bg-elevated"
                            }`}
                          >
                            <FileCode className="h-4 w-4 text-text-muted" />
                            <div className="flex-1 text-left">
                              <div className="font-medium">{result.name}</div>
                              <div className="text-xs text-text-muted">
                                {result.file}:{result.line}
                              </div>
                            </div>
                            <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
                              {result.kind}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {query &&
                    filteredCommands.length === 0 &&
                    results.length === 0 &&
                    !isSearching && (
                      <p className="py-6 text-center text-sm text-text-muted">
                        No results found
                      </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-4 border-t border-border-default px-4 py-2">
                  <span className="flex items-center gap-1 text-[10px] text-text-muted">
                    <kbd className="rounded border border-border-default bg-bg-elevated px-1 py-0.5 font-mono">
                      ↑↓
                    </kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-text-muted">
                    <kbd className="rounded border border-border-default bg-bg-elevated px-1 py-0.5 font-mono">
                      ↵
                    </kbd>
                    select
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-text-muted">
                    <kbd className="rounded border border-border-default bg-bg-elevated px-1 py-0.5 font-mono">
                      esc
                    </kbd>
                    close
                  </span>
                </div>
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}
