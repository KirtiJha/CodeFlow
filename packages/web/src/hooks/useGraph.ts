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
  const highlightTimerRef = useRef<number | null>(null);

  // Store callbacks in refs so sigma doesn't get destroyed when they change
  const onNodeClickRef = useRef(onNodeClick);
  const onNodeHoverRef = useRef(onNodeHover);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);
  useEffect(() => { onNodeHoverRef.current = onNodeHover; }, [onNodeHover]);

  // Initialize Sigma
  useEffect(() => {
    if (!container || !graph) return;

    let sigma: Sigma | null = null;
    let observer: ResizeObserver | null = null;

    const initSigma = () => {
      // Don't initialize if container has no dimensions yet
      if (container.offsetWidth === 0 || container.offsetHeight === 0) return;
      if (sigmaRef.current) return; // already initialized

      sigma = new Sigma(graph, container, {
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
        // Clear any hover reducers before opening detail panel.
        // In some resize/reflow paths, leaveNode may not fire.
        resetHighlight(sigma!, graph);
        onNodeHoverRef.current?.(null);
        onNodeClickRef.current?.(node);
      });

      sigma.on("enterNode", ({ node }) => {
        onNodeHoverRef.current?.(node);
        highlightNeighbors(sigma!, graph, node);
      });

      sigma.on("leaveNode", () => {
        onNodeHoverRef.current?.(null);
        resetHighlight(sigma!, graph);
      });

      sigmaRef.current = sigma;
    };

    // Try immediately
    initSigma();

    // If container didn't have dimensions, wait via ResizeObserver
    if (!sigmaRef.current) {
      observer = new ResizeObserver(() => {
        if (!sigmaRef.current && container.offsetWidth > 0 && container.offsetHeight > 0) {
          initSigma();
          observer?.disconnect();
        }
      });
      observer.observe(container);
    }

    // Watch container size changes to refresh sigma's canvas dimensions.
    // sigma v3 only listens for window 'resize', not container resize.
    // Debounce and track last known size to avoid resize loops (sigma's
    // canvases are children of the observed container).
    let lastW = container.offsetWidth;
    let lastH = container.offsetHeight;
    let rafId: number | null = null;
    const sizeObserver = new ResizeObserver(() => {
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        sigmaRef.current?.resize();
        sigmaRef.current?.refresh();
        rafId = null;
      });
    });
    sizeObserver.observe(container);

    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
      if (rafId) cancelAnimationFrame(rafId);
      sizeObserver.disconnect();
      observer?.disconnect();
      if (sigmaRef.current) {
        sigmaRef.current.kill();
        sigmaRef.current = null;
      }
      sigma = null;
    };
  }, [container, graph]);

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
      // Keep viewport stable: highlight the target in-place instead of moving camera.
      resetHighlight(sigmaRef.current, graph);
      const neighbors = new Set(graph.neighbors(nodeId));
      neighbors.add(nodeId);

      const sigma = sigmaRef.current;
      sigma.setSetting("nodeReducer", (node, data) => {
        if (node === nodeId) {
          return {
            ...data,
            color: "#f59e0b",
            size: Math.max((data.size as number) || 4, 10),
            label: data.label,
          };
        }
        if (neighbors.has(node)) {
          return {
            ...data,
            color: "#fb923c",
            size: Math.max((data.size as number) || 3, 6),
          };
        }
        return { ...data, color: "#2f3146" };
      });

      sigma.setSetting("edgeReducer", (edge, data) => {
        const source = graph.source(edge);
        const target = graph.target(edge);
        if (source === nodeId || target === nodeId) {
          return {
            ...data,
            color: "#f59e0b",
            size: Math.max((data.size as number) || 1, 2),
          };
        }
        if (neighbors.has(source) && neighbors.has(target)) {
          return { ...data, color: "#334155" };
        }
        return { ...data, color: "#1f2937" };
      });

      sigma.refresh();

      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        if (!sigmaRef.current || !graph) return;
        resetHighlight(sigmaRef.current, graph);
        sigmaRef.current.refresh();
      }, 1800);
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

  // Force refresh sigma dimensions and re-render
  const refresh = useCallback(() => {
    sigmaRef.current?.resize();
    sigmaRef.current?.refresh();
  }, []);

  return {
    sigma: sigmaRef.current,
    runLayout,
    zoomToNode,
    zoomToFit,
    filterByKind,
    searchNodes,
    refresh,
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
      // Dim non-neighbor edges but keep them visible to avoid blank-looking graph.
      return { ...data, color: "#15152a" };
    }
    return data;
  });
}

function resetHighlight(sigma: Sigma, _graph: Graph) {
  sigma.setSetting("nodeReducer", null);
  sigma.setSetting("edgeReducer", null);
}
