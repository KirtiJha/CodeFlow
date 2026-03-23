import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { TaintFlow } from "@/types/security";
import { getSeverityColor } from "@/lib/color-system";

/* ── Severity order used for layout ──────────────────────────── */
const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/* ── Category labels ─────────────────────────────────────────── */
const CAT_LABELS: Record<string, string> = {
  sql_injection: "SQL Injection",
  xss: "Cross-Site Scripting",
  command_injection: "Command Injection",
  path_traversal: "Path Traversal",
  ssrf: "Server-Side Request Forgery",
  open_redirect: "Open Redirect",
  pii_leak: "PII Leak",
  hardcoded_secret: "Hardcoded Secret",
  missing_auth: "Missing Auth Check",
  insecure_deserialization: "Insecure Deserialization",
  prototype_pollution: "Prototype Pollution",
  unsafe_regex: "Unsafe Regex",
};

function catLabel(cat: string) {
  return CAT_LABELS[cat] ?? cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Severity colors ─────────────────────────────────────────── */
const SEV_COLORS: Record<string, { node: string; border: string; bg: string; text: string }> = {
  critical: { node: "rgba(239,68,68,0.12)", border: "#ef4444", bg: "rgba(239,68,68,0.08)", text: "#ef4444" },
  high:     { node: "rgba(249,115,22,0.12)", border: "#f97316", bg: "rgba(249,115,22,0.08)", text: "#f97316" },
  medium:   { node: "rgba(245,158,11,0.12)", border: "#f59e0b", bg: "rgba(245,158,11,0.08)", text: "#f59e0b" },
  low:      { node: "rgba(16,185,129,0.12)", border: "#10b981", bg: "rgba(16,185,129,0.08)", text: "#10b981" },
};

function sevColor(sev: string) {
  return SEV_COLORS[sev] ?? SEV_COLORS.medium;
}

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

  const { nodes, edges } = useMemo(() => {
    if (flows.length === 0) return { nodes: [], edges: [] };

    const nodeMap = new Map<string, Node>();
    const edgeList: Edge[] = [];

    // Group flows by category for organized layout
    const byCategory = new Map<string, TaintFlow[]>();
    for (const flow of flows) {
      if (!byCategory.has(flow.category)) byCategory.set(flow.category, []);
      byCategory.get(flow.category)!.push(flow);
    }

    // Sort category groups by highest severity
    const sortedCategories = [...byCategory.entries()].sort((a, b) => {
      const aMin = Math.min(...a[1].map((f) => SEV_ORDER[f.severity] ?? 3));
      const bMin = Math.min(...b[1].map((f) => SEV_ORDER[f.severity] ?? 3));
      return aMin - bMin;
    });

    const NODE_W = 260;
    const NODE_H = 60;
    const H_GAP = 180;   // horizontal gap between source → sink columns
    const V_GAP = 16;    // vertical gap between nodes in same category
    const CAT_GAP = 60;  // vertical gap between category groups
    const SOURCE_X = 60;
    const SINK_X = SOURCE_X + NODE_W + H_GAP;

    let currentY = 40;

    for (const [cat, catFlows] of sortedCategories) {
      const catColor = sevColor(catFlows[0]?.severity ?? "medium");

      // Category header node
      const catNodeId = `cat-${cat}`;
      nodeMap.set(catNodeId, {
        id: catNodeId,
        type: "default",
        position: { x: SOURCE_X + (NODE_W + H_GAP) / 2 - 80, y: currentY },
        data: { label: `${catLabel(cat)} (${catFlows.length})` },
        selectable: false,
        draggable: false,
        style: {
          background: "transparent",
          border: "none",
          color: catColor.text,
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase" as const,
          letterSpacing: "0.05em",
          padding: "2px 8px",
          width: "auto",
        },
      });

      currentY += 32;

      // De-duplicate sinks: group findings by sink file+line
      const sinkGroups = new Map<string, TaintFlow[]>();
      for (const flow of catFlows) {
        const sinkKey = `${flow.sink.file}:${flow.sink.line}`;
        if (!sinkGroups.has(sinkKey)) sinkGroups.set(sinkKey, []);
        sinkGroups.get(sinkKey)!.push(flow);
      }

      let rowIdx = 0;
      for (const [sinkKey, sinkFlows] of sinkGroups) {
        const flow = sinkFlows[0]!;
        const isSelected = sinkFlows.some((f) => f.id === selectedFlowId);
        const sc = sevColor(flow.severity);
        const rowY = currentY + rowIdx * (NODE_H + V_GAP);

        // Source node (left side)
        const sourceId = `src-${flow.id}`;
        const sourceLabel = flow.source?.name ?? flow.source?.symbol ?? "Data Source";
        if (!nodeMap.has(sourceId)) {
          nodeMap.set(sourceId, {
            id: sourceId,
            position: { x: SOURCE_X, y: rowY },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            data: {
              label: sourceLabel,
              flowId: flow.id,
              kind: "source",
              file: flow.source?.file,
              line: flow.source?.line,
            },
            style: {
              background: isSelected ? "rgba(59,130,246,0.15)" : "rgba(26,26,46,0.9)",
              border: `1px solid ${isSelected ? "#3b82f6" : "#2a2a3e"}`,
              borderLeft: `3px solid #3b82f6`,
              borderRadius: "8px",
              padding: "8px 12px",
              color: "#c0c0d8",
              fontSize: "11px",
              fontFamily: "JetBrains Mono, monospace",
              width: `${NODE_W}px`,
              opacity: selectedFlowId && !isSelected ? 0.35 : 1,
            },
          });
        }

        // Sink node (right side)
        const sinkId = `sink-${sinkKey}`;
        const sinkSymbol = flow.sink?.symbol ?? flow.sink?.name ?? "Sink";
        const truncatedSymbol = sinkSymbol.length > 50 ? sinkSymbol.slice(0, 47) + "…" : sinkSymbol;
        if (!nodeMap.has(sinkId)) {
          nodeMap.set(sinkId, {
            id: sinkId,
            position: { x: SINK_X, y: rowY },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            data: {
              label: truncatedSymbol,
              flowId: flow.id,
              kind: "sink",
              file: flow.sink?.file,
              line: flow.sink?.line,
              count: sinkFlows.length,
            },
            style: {
              background: isSelected ? sc.node : "rgba(26,26,46,0.9)",
              border: `1px solid ${isSelected ? sc.border : "#2a2a3e"}`,
              borderLeft: `3px solid ${sc.border}`,
              borderRadius: "8px",
              padding: "8px 12px",
              color: "#f0f0f5",
              fontSize: "11px",
              fontFamily: "JetBrains Mono, monospace",
              width: `${NODE_W}px`,
              opacity: selectedFlowId && !isSelected ? 0.35 : 1,
            },
          });
        }

        // Edge: source → sink
        edgeList.push({
          id: `e-${flow.id}`,
          source: sourceId,
          target: sinkId,
          animated: isSelected,
          style: {
            stroke: isSelected ? sc.border : "#444466",
            strokeWidth: isSelected ? 2.5 : 1.5,
            opacity: selectedFlowId && !isSelected ? 0.15 : 0.7,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isSelected ? sc.border : "#555577",
            width: 14,
            height: 14,
          },
          label: sinkFlows.length > 1 ? `${sinkFlows.length}×` : undefined,
          labelStyle: {
            fill: "#888",
            fontSize: "10px",
          },
          labelBgStyle: {
            fill: "#12121c",
          },
        });

        rowIdx++;
      }

      currentY += sinkGroups.size * (NODE_H + V_GAP) + CAT_GAP;
    }

    return { nodes: Array.from(nodeMap.values()), edges: edgeList };
  }, [flows, selectedFlowId]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const flowId = node.data?.flowId as string | undefined;
      if (!flowId) return;
      const flow = flows.find((f) => f.id === flowId);
      if (flow) onFlowSelect?.(flow);
    },
    [flows, onFlowSelect],
  );

  if (flows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No security findings to visualize
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
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "smoothstep",
        }}
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
          nodeColor={(n) => {
            if (n.data?.kind === "source") return "#3b82f6";
            const sev = n.data?.severity as string;
            return sevColor(sev).border;
          }}
          maskColor="rgba(10, 10, 15, 0.8)"
        />
      </ReactFlow>
      )}
    </div>
  );
}
