import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FileCode, X } from "lucide-react";
import { useSearch } from "@/hooks/useSearch";
import { Badge } from "@/components/shared/Badge";
import { truncatePath } from "@/lib/formatters";

interface SymbolSearchProps {
  onSelect: (file: string, line: number, name: string) => void;
  className?: string;
}

export function SymbolSearch({ onSelect, className = "" }: SymbolSearchProps) {
  const { query, results, isSearching, search, clear } = useSearch({
    debounceMs: 200,
    limit: 15,
    mode: "hybrid",
  });
  const [isFocused, setIsFocused] = useState(false);

  const handleSelect = useCallback(
    (result: { file: string; line: number; name: string }) => {
      onSelect(result.file, result.line, result.name);
      clear();
      setIsFocused(false);
    },
    [onSelect, clear],
  );

  return (
    <div className={`relative ${className}`}>
      <div
        className={`flex items-center gap-2 rounded-lg border bg-bg-surface px-3 py-2 transition-colors ${
          isFocused ? "border-border-focus" : "border-border-default"
        }`}
      >
        <Search className="h-4 w-4 text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => search(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder="Search symbols…"
          className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
        />
        {query && (
          <button
            onClick={clear}
            className="text-text-muted hover:text-text-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {isSearching && (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
        )}
      </div>

      <AnimatePresence>
        {isFocused && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-border-default bg-bg-elevated shadow-xl"
          >
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => handleSelect(result)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-bg-surface"
              >
                <FileCode className="h-4 w-4 flex-shrink-0 text-text-muted" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-text-primary">
                    {result.name}
                  </div>
                  <div className="truncate text-xs text-text-muted">
                    {truncatePath(result.file)}:{result.line}
                  </div>
                </div>
                <Badge variant="kind" value={result.kind} />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
