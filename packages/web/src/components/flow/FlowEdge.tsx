import { memo } from "react";
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
  type Edge,
  EdgeLabelRenderer,
} from "@xyflow/react";

interface FlowEdgeData {
  [key: string]: unknown;
  kind: string;
  label?: string;
  color: string;
}

export const FlowEdge = memo(function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<Edge<FlowEdgeData>>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const color = data?.color ?? "#3b82f6";

  return (
    <>
      {/* Background glow */}
      <BaseEdge
        id={`${id}-glow`}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 4 : 2,
          opacity: 0.15,
          filter: "blur(4px)",
        }}
      />

      {/* Main edge with animated dash */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray: "8 4",
          animation: "flow-dash 1.5s linear infinite",
        }}
      />

      {/* Animated particle */}
      <circle r="3" fill={color}>
        <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
      </circle>

      {/* Label */}
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="rounded bg-bg-elevated/90 px-1.5 py-0.5 text-[9px] font-medium text-text-muted"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
