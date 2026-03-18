import { useCallback, useMemo } from "react";
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
import type { SchemaModel, SchemaReference } from "@/types/api";

interface SchemaGraphProps {
  models: SchemaModel[];
  references: SchemaReference[];
  selectedModel?: string | null;
  onModelSelect?: (model: SchemaModel) => void;
  className?: string;
}

export function SchemaGraph({
  models,
  references,
  selectedModel,
  onModelSelect,
  className = "",
}: SchemaGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(models.length));

    const nodeList: Node[] = models.map((model, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const isSelected = model.name === selectedModel;

      return {
        id: model.name,
        position: { x: col * 260, y: row * 160 },
        data: {
          label: model.name,
          fieldCount: model.fields.length,
        },
        style: {
          background: isSelected
            ? "rgba(59, 130, 246, 0.1)"
            : "rgba(18, 18, 28, 0.95)",
          border: `1px solid ${isSelected ? "#3b82f6" : "#2a2a3e"}`,
          borderRadius: "10px",
          padding: "10px 14px",
          color: "#f0f0f5",
          fontSize: "13px",
          fontWeight: "600",
          minWidth: "140px",
        },
      };
    });

    const edgeList: Edge[] = references
      .filter((ref): ref is SchemaReference & { from: string; to: string } => !!ref.from && !!ref.to)
      .map((ref, i) => ({
      id: `ref-${i}`,
      source: ref.from,
      target: ref.to,
      label: ref.field,
      labelStyle: { fill: "#6b7280", fontSize: 10 },
      style: {
        stroke: ref.type === "foreign_key" ? "#8b5cf6" : "#3b82f6",
        strokeWidth: 1.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: ref.type === "foreign_key" ? "#8b5cf6" : "#3b82f6",
      },
      animated: ref.from === selectedModel || ref.to === selectedModel,
    }));

    return { nodes: nodeList, edges: edgeList };
  }, [models, references, selectedModel]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const model = models.find((m) => m.name === node.id);
      if (model) onModelSelect?.(model);
    },
    [models, onModelSelect],
  );

  if (models.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No schema models found
      </div>
    );
  }

  return (
    <div className={`h-full w-full ${className}`}>
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
          nodeColor="#8b5cf6"
          maskColor="rgba(10, 10, 15, 0.8)"
        />
      </ReactFlow>
    </div>
  );
}
