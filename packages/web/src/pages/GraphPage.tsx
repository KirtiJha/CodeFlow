import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import Graph from "graphology";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import type { GraphCanvasHandle } from "@/components/graph/GraphCanvas";
import { GraphControls } from "@/components/graph/GraphControls";
import { GraphLegend } from "@/components/graph/GraphLegend";
import { GraphMinimap } from "@/components/graph/GraphMinimap";
import { GraphCodeViewer } from "@/components/code/GraphCodeViewer";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useUIStore } from "@/stores/ui-store";
import { api } from "@/lib/api-client";
import type { NodeDetailResponse } from "@/lib/api-client";
import { PAGE_VARIANTS } from "@/lib/constants";
import { buildGraphologyInstance, apiNodesToGraphNodes, apiEdgesToGraphEdges } from "@/lib/graph-adapter";
import type { GraphData, GraphNodeData, GraphFilter } from "@/types/graph";

export function GraphPage() {
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [nodeDetail, setNodeDetail] = useState<NodeDetailResponse | null>(null);
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
      const raw = res.data as { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] };
      const nodes = apiNodesToGraphNodes(raw.nodes);
      const edges = apiEdgesToGraphEdges(raw.edges);
      const communities = [...new Set(nodes.map((n) => n.community).filter(Boolean))].map((id) => ({
        id: id!,
        label: `Community ${id}`,
        nodeCount: nodes.filter((n) => n.community === id).length,
        color: "#666",
        topNodes: [],
      }));
      setGraphData({
        nodes,
        edges,
        communities,
        stats: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          communityCount: communities.length,
          density: nodes.length > 1 ? (2 * edges.length) / (nodes.length * (nodes.length - 1)) : 0,
          avgDegree: nodes.length > 0 ? (2 * edges.length) / nodes.length : 0,
        },
      });
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const openNodeDetail = useCallback(
    async (nodeId: string, zoomToNode = false) => {
      const node = graphData?.nodes.find((n) => n.id === nodeId) ?? null;
      // Even if not in the current graph view, still load detail panel
      setSelectedNode(
        node
          ? { ...node }
          : { id: nodeId, name: nodeId, kind: "function", file: "", line: 0 } as GraphNodeData,
      );
      setNodeDetail(null);
      // Only zoom when navigating from code-panel badges/chips.
      // Direct graph clicks should not move the camera unexpectedly.
      if (zoomToNode) {
        canvasRef.current?.zoomToNode(nodeId);
      }
      try {
        const res = await api.nodeDetail(nodeId);
        if (res.data) {
          setNodeDetail(res.data);
          // Update selectedNode with real info from detail response
          if (!node) {
            const d = res.data.node;
            setSelectedNode({
              id: d.id,
              name: d.name,
              kind: d.kind,
              file: d.file,
              line: d.line,
            } as GraphNodeData);
          }
        }
      } catch {
        // detail not available
      }
    },
    [graphData],
  );

  const handleGraphNodeClick = useCallback(
    (nodeId: string) => {
      void openNodeDetail(nodeId, false);
    },
    [openNodeDetail],
  );

  const handleCodeNavigate = useCallback(
    (nodeId: string) => {
      void openNodeDetail(nodeId, true);
    },
    [openNodeDetail],
  );

  const handleCloseDetail = useCallback(() => {
    setSelectedNode(null);
    setNodeDetail(null);
  }, []);

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
          <div className="flex h-full">
            {/* Graph canvas — always mounted, flex-grows to fill space */}
            <div className="relative flex-1 min-w-0 h-full overflow-hidden">
              <GraphCanvas
                ref={canvasRef}
                data={graphData}
                onNodeClick={handleGraphNodeClick}
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

            {/* Detail panel — slides in from right, never remounts the graph */}
            {selectedNode && (
              <div className="h-full w-[440px] shrink-0 border-l border-border-default overflow-hidden">
                {nodeDetail ? (
                  <GraphCodeViewer
                    detail={nodeDetail}
                    onNodeNavigate={handleCodeNavigate}
                    onClose={handleCloseDetail}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-text-muted">
                    <LoadingSpinner size="sm" />
                  </div>
                )}
              </div>
            )}
          </div>
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
