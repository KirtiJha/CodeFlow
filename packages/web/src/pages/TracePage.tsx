import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { FlowDiagram } from "@/components/flow/FlowDiagram";
import { FlowControls } from "@/components/flow/FlowControls";
import { CodeViewer } from "@/components/code/CodeViewer";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useTraceStore } from "@/stores/trace-store";
import { api } from "@/lib/api-client";
import { PAGE_VARIANTS } from "@/lib/constants";
import type { TraceResult, TraceQuery } from "@/types/trace";

export function TracePage() {
  const {
    result,
    query,
    selectedNode,
    isTracing,
    setResult,
    setQuery,
    selectNode,
    setTracing,
  } = useTraceStore();
  const [symbol, setSymbol] = useState(query?.symbol ?? "");

  const handleQueryChange = useCallback(
    (partial: Partial<TraceQuery>) => {
      setQuery({
        file: "",
        symbol: symbol.trim(),
        depth: 5,
        direction: "forward",
        includeTests: false,
        ...query,
        ...partial,
      });
    },
    [query, setQuery, symbol],
  );

  const handleTrace = useCallback(async () => {
    if (!symbol.trim()) return;
    setTracing(true);
    const direction = query?.direction ?? "forward";
    const depth = query?.depth ?? 5;

    try {
      const res = await api.trace({
        file: "",
        symbol: symbol.trim(),
        direction,
        depth,
      });
      setResult(res.data as TraceResult);
    } catch {
      setResult(null);
    } finally {
      setTracing(false);
    }
  }, [symbol, query, setResult, setTracing]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const node = result?.nodes.find((n) => n.id === nodeId) ?? null;
      selectNode(node);
    },
    [result, selectNode],
  );

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex h-full flex-col"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border-default px-4 py-3">
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && handleTrace()
          }
          placeholder="Enter symbol to trace (e.g., processPayment, req.body)..."
          className="flex-1 rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <FlowControls query={query} onQueryChange={handleQueryChange} onTrace={handleTrace} isTracing={isTracing} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isTracing ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : result ? (
          <Allotment>
            <Allotment.Pane minSize={400}>
              <FlowDiagram
                trace={result}
                onNodeClick={handleNodeClick}
              />
            </Allotment.Pane>
            {selectedNode && (
              <Allotment.Pane minSize={300} preferredSize={400}>
                <div className="flex h-full flex-col border-l border-border-default">
                  <div className="border-b border-border-default px-4 py-3">
                    <div className="text-sm font-semibold text-text-primary">
                      {selectedNode.name}
                    </div>
                    <div className="text-xs text-text-muted">
                      {selectedNode.file}:{selectedNode.line}
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <CodeViewer
                      code={selectedNode.codeSnippet ?? ""}
                      language={selectedNode.language ?? "typescript"}
                      highlightLines={
                        selectedNode.line ? [selectedNode.line] : []
                      }
                    />
                  </div>
                </div>
              </Allotment.Pane>
            )}
          </Allotment>
        ) : (
          <EmptyState
            icon="search"
            title="Trace Data Flows"
            description="Enter a symbol name to trace how data flows through your codebase — across function calls, modules, and transformations."
          />
        )}
      </div>
    </motion.div>
  );
}
