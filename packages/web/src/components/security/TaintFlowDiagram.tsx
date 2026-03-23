import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { TaintFlow } from "@/types/security";
import { getSeverityColor } from "@/lib/color-system";

interface TaintFlowDiagramProps {
  flows: TaintFlow[];
  selectedFlowId?: string | null;
  onFlowSelect?: (flow: TaintFlow) => void;
  className?: string;
}

export function TaintFlowDiagram({
  flows,
  selectedFlowId,
  onFlowSelect,
  className = "",
}: TaintFlowDiagramProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasSize, setHasSize] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setHasSize(rect.width > 0 && rect.height > 0);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const edgeList: Edge[] = [];

    flows.forEach((flow, fi) => {
      const isSelected = flow.id === selectedFlowId;
      const color = getSeverityColor(flow.severity);

      flow.path.forEach((loc, li) => {
        const nodeId = `${loc.file}:${loc.line}:${loc.symbol}`;

        if (!nodeMap.has(nodeId)) {
          const isSource = li === 0;
          const isSink = li === flow.path.length - 1;

          nodeMap.set(nodeId, {
            id: nodeId,
            position: { x: li * 240, y: fi * 100 },
            data: {
              label: loc.symbol,
              file: loc.file,
              line: loc.line,
              isSource,
              isSink,
              severity: flow.severity,
            },
            style: {
              background: isSource
                ? "rgba(239, 68, 68, 0.15)"
                : isSink
                  ? "rgba(245, 158, 11, 0.15)"
                  : "rgba(26, 26, 46, 0.9)",
              border: `1px solid ${
                isSource ? "#ef4444" : isSink ? "#f59e0b" : "#2a2a3e"
              }`,
              borderRadius: "8px",
              padding: "8px 12px",
              color: "#f0f0f5",
              fontSize: "12px",
              fontFamily: "JetBrains Mono, monospace",
              opacity: isSelected || !selectedFlowId ? 1 : 0.3,
            },
          });
        }

        if (li > 0) {
          const prevLoc = flow.path[li - 1];
          const sourceId = `${prevLoc.file}:${prevLoc.line}:${prevLoc.symbol}`;

          edgeList.push({
            id: `e-${fi}-${li}`,
            source: sourceId,
            target: nodeId,
            animated: isSelected,
            style: {
              stroke: color.text,
              strokeWidth: isSelected ? 2 : 1,
              opacity: isSelected || !selectedFlowId ? 0.8 : 0.2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: color.text,
            },
          });
        }
      });
    });

    return { nodes: Array.from(nodeMap.values()), edges: edgeList };
  }, [flows, selectedFlowId]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const flow = flows.find((f) =>
        f.path.some(
          (loc) => `${loc.file}:${loc.line}:${loc.symbol}` === node.id,
        ),
      );
      if (flow) onFlowSelect?.(flow);
    },
    [flows, onFlowSelect],
  );

  if (flows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No taint flows detected
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`h-full w-full ${className}`}
      style={{ minHeight: 280 }}
    >
      {hasSize && (
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        fitView
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1a1a2e" gap={20} />
        <Controls
          style={{
            background: "#12121c",
            border: "1px solid #2a2a3e",
            borderRadius: "8px",
          }}
        />
        <MiniMap
          style={{
            background: "#0a0a0f",
            border: "1px solid #2a2a3e",
            borderRadius: "8px",
          }}
          nodeColor="#3b82f6"
          maskColor="rgba(10, 10, 15, 0.8)"
        />
      </ReactFlow>
      )}
    </div>
  );
}
