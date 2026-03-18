import { useRef, useEffect, useState } from "react";
import Graph from "graphology";
import { useGraph } from "@/hooks/useGraph";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import type { GraphData } from "@/types/graph";
import { buildGraphologyInstance } from "@/lib/graph-adapter";

interface GraphCanvasProps {
  data: GraphData | null;
  isLoading?: boolean;
  onNodeClick?: (nodeId: string) => void;
  onNodeHover?: (nodeId: string | null) => void;
  className?: string;
}

export function GraphCanvas({
  data,
  isLoading,
  onNodeClick,
  onNodeHover,
  className = "",
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graph, setGraph] = useState<Graph | null>(null);

  useEffect(() => {
    if (data && data.nodes.length > 0) {
      const g = buildGraphologyInstance(data);
      setGraph(g);
    } else {
      setGraph(null);
    }
  }, [data]);

  const { runLayout, zoomToFit } = useGraph({
    container: containerRef.current,
    graph,
    onNodeClick,
    onNodeHover,
  });

  // Run layout after graph is ready
  useEffect(() => {
    if (graph) {
      requestAnimationFrame(() => {
        runLayout(200);
      });
    }
  }, [graph, runLayout]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className={className}>
        <EmptyState
          icon="database"
          title="No graph data"
          description="Run an analysis to populate the graph"
        />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="h-full w-full" />

      {/* Quick actions overlay */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          onClick={zoomToFit}
          className="glass rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          Fit
        </button>
        <button
          onClick={() => runLayout(100)}
          className="glass rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          Re-layout
        </button>
      </div>
    </div>
  );
}
