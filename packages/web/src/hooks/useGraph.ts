import { useCallback, useRef, useEffect } from "react";
import Graph from "graphology";
import { Sigma } from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";

interface UseGraphOptions {
  container: HTMLElement | null;
  graph: Graph | null;
  onNodeClick?: (nodeId: string) => void;
  onNodeHover?: (nodeId: string | null) => void;
}

export function useGraph({
  container,
  graph,
  onNodeClick,
  onNodeHover,
}: UseGraphOptions) {
  const sigmaRef = useRef<Sigma | null>(null);

  // Initialize Sigma
  useEffect(() => {
    if (!container || !graph) return;

    const sigma = new Sigma(graph, container, {
      renderEdgeLabels: false,
      enableEdgeEvents: true,
      defaultNodeColor: "#6b7280",
      defaultEdgeColor: "#2a2a3e",
      labelColor: { color: "#a0a0b8" },
      labelFont: "Inter, system-ui, sans-serif",
      labelSize: 12,
      labelWeight: "500",
      minCameraRatio: 0.05,
      maxCameraRatio: 10,
      nodeProgramClasses: {},
    });

    sigma.on("clickNode", ({ node }) => {
      onNodeClick?.(node);
    });

    sigma.on("enterNode", ({ node }) => {
      onNodeHover?.(node);
      highlightNeighbors(sigma, graph, node);
    });

    sigma.on("leaveNode", () => {
      onNodeHover?.(null);
      resetHighlight(sigma, graph);
    });

    sigmaRef.current = sigma;

    return () => {
      sigma.kill();
      sigmaRef.current = null;
    };
  }, [container, graph, onNodeClick, onNodeHover]);

  // Layout
  const runLayout = useCallback(
    (iterations = 100) => {
      if (!graph) return;
      forceAtlas2.assign(graph, {
        iterations,
        settings: {
          gravity: 1,
          scalingRatio: 2,
          strongGravityMode: true,
          barnesHutOptimize: graph.order > 1000,
        },
      });
      sigmaRef.current?.refresh();
    },
    [graph],
  );

  // Zoom to node
  const zoomToNode = useCallback(
    (nodeId: string) => {
      if (!sigmaRef.current || !graph?.hasNode(nodeId)) return;
      const attrs = graph.getNodeAttributes(nodeId);
      const camera = sigmaRef.current.getCamera();
      camera.animate(
        { x: attrs.x, y: attrs.y, ratio: 0.15 },
        { duration: 500 },
      );
    },
    [graph],
  );

  // Zoom to fit
  const zoomToFit = useCallback(() => {
    sigmaRef.current
      ?.getCamera()
      .animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 500 });
  }, []);

  // Filter nodes
  const filterByKind = useCallback(
    (kinds: string[]) => {
      if (!graph || !sigmaRef.current) return;
      const kindSet = new Set(kinds);
      sigmaRef.current.setSetting("nodeReducer", (node, data) => {
        if (
          kindSet.size > 0 &&
          !kindSet.has(graph.getNodeAttribute(node, "kind"))
        ) {
          return { ...data, hidden: true };
        }
        return data;
      });
      sigmaRef.current.refresh();
    },
    [graph],
  );

  // Search nodes
  const searchNodes = useCallback(
    (query: string): string[] => {
      if (!graph || !query) return [];
      const lower = query.toLowerCase();
      const results: string[] = [];
      graph.forEachNode((node, attrs) => {
        if (attrs.label?.toLowerCase().includes(lower)) {
          results.push(node);
        }
      });
      return results.slice(0, 50);
    },
    [graph],
  );

  return {
    sigma: sigmaRef.current,
    runLayout,
    zoomToNode,
    zoomToFit,
    filterByKind,
    searchNodes,
  };
}

function highlightNeighbors(sigma: Sigma, graph: Graph, nodeId: string) {
  const neighbors = new Set(graph.neighbors(nodeId));
  neighbors.add(nodeId);

  sigma.setSetting("nodeReducer", (node, data) => {
    if (!neighbors.has(node)) {
      return { ...data, color: "#1a1a2e", label: "" };
    }
    return data;
  });

  sigma.setSetting("edgeReducer", (edge, data) => {
    const source = graph.source(edge);
    const target = graph.target(edge);
    if (!neighbors.has(source) || !neighbors.has(target)) {
      return { ...data, color: "#0f0f1a", hidden: true };
    }
    return data;
  });
}

function resetHighlight(sigma: Sigma, _graph: Graph) {
  sigma.setSetting("nodeReducer", null);
  sigma.setSetting("edgeReducer", null);
}
