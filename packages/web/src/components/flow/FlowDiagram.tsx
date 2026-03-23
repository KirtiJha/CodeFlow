import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FlowNode } from "./FlowNode";
import { FlowEdge } from "./FlowEdge";
import type { TraceResult } from "@/types/trace";
import { getNodeColor, getEdgeColor } from "@/lib/color-system";

interface FlowDiagramProps {
  trace: TraceResult | null;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

const nodeTypes = {
  flowNode: FlowNode,
} as NodeTypes;

const edgeTypes = {
  flowEdge: FlowEdge,
} as EdgeTypes;

export function FlowDiagram({
  trace,
  onNodeClick,
  className = "",
}: FlowDiagramProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasSize, setHasSize] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const check = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setHasSize(true);
        observer.disconnect();
      }
    };

    const observer = new ResizeObserver(check);
    check();
    if (!hasSize) observer.observe(el);

    return () => observer.disconnect();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!trace) return { initialNodes: [], initialEdges: [] };

    const nodes: Node[] = trace.nodes.map((n, i) => ({
      id: n.id,
      type: "flowNode",
      position: { x: (n.depth % 4) * 280, y: Math.floor(i / 4) * 120 },
      data: {
        label: n.name,
        kind: n.kind,
        file: n.file,
        line: n.line,
        language: n.language,
        depth: n.depth,
        color: getNodeColor(n.kind),
      },
    }));

    const edges: Edge[] = trace.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "flowEdge",
      data: {
        kind: e.kind,
        label: e.label,
        color: getEdgeColor(e.kind),
      },
      animated: true,
    }));

    return { initialNodes: nodes, initialEdges: edges };
  }, [trace]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick],
  );

  if (!trace || trace.nodes.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`${className}`}
      style={{ width: "100%", height: "100%", minHeight: 300 }}
    >
      {hasSize && (
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="bg-bg-base"
      >
        <Background color="#1a1a2e" gap={20} size={1} />
        <Controls className="[&>button]:border-border-default [&>button]:bg-bg-surface [&>button]:text-text-muted [&>button]:hover:bg-bg-elevated [&>button]:hover:text-text-primary" />
        <MiniMap
          nodeColor={(n) => (n.data?.color as string) ?? "#6b7280"}
          maskColor="rgba(10, 10, 15, 0.8)"
          className="border border-border-default !bg-bg-surface"
        />
      </ReactFlow>
      )}
    </div>
  );
}
