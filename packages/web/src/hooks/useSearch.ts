import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "@/lib/api-client";
import type { SearchResult } from "@/types/api";

interface UseSearchOptions {
  debounceMs?: number;
  limit?: number;
  mode?: "hybrid" | "keyword" | "semantic";
}

export function useSearch(options: UseSearchOptions = {}) {
  const { debounceMs = 200, limit = 20, mode = "hybrid" } = options;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await api.search(searchQuery, mode, limit);
        setResults(
          (response.data as { results: SearchResult[] }).results ?? [],
        );
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [mode, limit],
  );

  const debouncedSearch = useCallback(
    (value: string) => {
      setQuery(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(value), debounceMs);
    },
    [search, debounceMs],
  );

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  return { query, results, isSearching, search: debouncedSearch, clear };
}
