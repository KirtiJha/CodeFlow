import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import Graph from "graphology";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { GraphControls } from "@/components/graph/GraphControls";
import { GraphLegend } from "@/components/graph/GraphLegend";
import { GraphMinimap } from "@/components/graph/GraphMinimap";
import { CodeViewer } from "@/components/code/CodeViewer";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Badge } from "@/components/shared/Badge";
import { useUIStore } from "@/stores/ui-store";
import { api } from "@/lib/api-client";
import { PAGE_VARIANTS } from "@/lib/constants";
import { buildGraphologyInstance } from "@/lib/graph-adapter";
import type { GraphData, GraphNodeData, GraphFilter } from "@/types/graph";

export function GraphPage() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<GraphFilter>({
    kinds: [],
    languages: [],
    communities: [],
    minRisk: 0,
    showTests: true,
    showEntryPoints: true,
    searchQuery: "",
  });
  const { activePanels } = useUIStore();

  const graphInstance = useMemo<Graph | null>(
    () => (graphData ? buildGraphologyInstance(graphData) : null),
    [graphData],
  );

  const availableKinds = useMemo(
    () => [...new Set(graphData?.nodes.map((n) => n.kind) ?? [])],
    [graphData],
  );

  const loadGraph = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.graph();
      setGraphData(res.data as GraphData);
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const node = graphData?.nodes.find((n) => n.id === nodeId) ?? null;
      setSelectedNode(node);
    },
    [graphData],
  );

  const handleFilterChange = useCallback(
    (partial: Partial<GraphFilter>) => {
      setFilter((prev) => ({ ...prev, ...partial }));
    },
    [],
  );

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex h-full flex-col"
    >
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : graphData ? (
          <Allotment>
            {/* Graph canvas */}
            <Allotment.Pane minSize={400}>
              <div className="relative h-full w-full">
                <GraphCanvas
                  data={graphData}
                  onNodeClick={handleNodeClick}
                />

                {/* Overlay controls */}
                <div className="absolute left-3 top-3 z-10">
                  <GraphControls
                    filter={filter}
                    onFilterChange={handleFilterChange}
                    onZoomIn={() => {}}
                    onZoomOut={() => {}}
                    onFit={() => {}}
                    onReLayout={loadGraph}
                    availableKinds={availableKinds}
                    availableLanguages={[]}
                    availableCommunities={[]}
                  />
                </div>

                {/* Legend overlay */}
                {activePanels.legend && (
                  <div className="absolute bottom-3 left-3 z-10">
                    <GraphLegend kinds={availableKinds} />
                  </div>
                )}

                {/* Minimap overlay */}
                {activePanels.minimap && graphInstance && (
                  <div className="absolute bottom-3 right-3 z-10">
                    <GraphMinimap
                      graph={graphInstance}
                      viewportX={0.5}
                      viewportY={0.5}
                      viewportRatio={1}
                    />
                  </div>
                )}
              </div>
            </Allotment.Pane>

            {/* Detail panel */}
            {activePanels.detail && selectedNode && (
              <Allotment.Pane minSize={280} preferredSize={380}>
                <div className="flex h-full flex-col border-l border-border-default">
                  <div className="border-b border-border-default px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">
                        {selectedNode.name}
                      </span>
                      <Badge variant="kind" value={selectedNode.kind} />
                    </div>
                    <div className="text-xs text-text-muted">
                      {selectedNode.file}
                      {selectedNode.line ? `:${selectedNode.line}` : ""}
                    </div>
                    {selectedNode.community !== undefined && (
                      <div className="mt-1 text-xs text-text-muted">
                        Community: {selectedNode.community}
                      </div>
                    )}
                  </div>

                  {/* Connections */}
                  {(selectedNode.inDegree || selectedNode.outDegree) && (
                    <div className="border-b border-border-default px-4 py-2">
                      <div className="flex items-center gap-4 text-xs text-text-muted">
                        <span>In: {selectedNode.inDegree ?? 0}</span>
                        <span>Out: {selectedNode.outDegree ?? 0}</span>
                        {selectedNode.riskScore !== undefined && (
                          <span>Risk: {selectedNode.riskScore}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Code preview */}
                  <div className="flex-1 overflow-auto">
                    {selectedNode.codeSnippet ? (
                      <CodeViewer
                        code={selectedNode.codeSnippet}
                        language={selectedNode.language ?? "typescript"}
                        highlightLines={
                          selectedNode.line ? [selectedNode.line] : []
                        }
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-text-muted">
                        No code preview available
                      </div>
                    )}
                  </div>
                </div>
              </Allotment.Pane>
            )}
          </Allotment>
        ) : (
          <EmptyState
            icon="graph"
            title="Codebase Graph"
            description="Analyze a repository to explore its code structure as an interactive graph."
          />
        )}
      </div>
    </motion.div>
  );
}
