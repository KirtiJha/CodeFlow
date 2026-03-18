import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { motion } from "framer-motion";
import { Badge } from "@/components/shared/Badge";
import { truncatePath } from "@/lib/formatters";

interface FlowNodeData {
  [key: string]: unknown;
  label: string;
  kind: string;
  file: string;
  line: number;
  language: string;
  depth: number;
  color: string;
}

export const FlowNode = memo(function FlowNode({
  data,
  selected,
}: NodeProps<Node<FlowNodeData>>) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`min-w-52 rounded-lg border bg-bg-surface p-3 shadow-lg transition-all ${
        selected
          ? "border-accent-blue shadow-accent-blue/10"
          : "border-border-default"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-2 !border-bg-surface !bg-accent-blue"
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: data.color }}
            />
            <span className="truncate text-sm font-semibold text-text-primary">
              {data.label}
            </span>
          </div>
          <p className="mt-1 truncate text-[10px] text-text-muted">
            {truncatePath(data.file)}:{data.line}
          </p>
        </div>
        <Badge variant="kind" value={data.kind} />
      </div>

      {/* Depth indicator */}
      <div className="mt-2 flex items-center gap-1">
        {Array.from({ length: Math.min(data.depth + 1, 5) }, (_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{
              backgroundColor:
                i <= data.depth ? data.color : "var(--color-bg-elevated)",
              opacity: 0.4 + (i / 5) * 0.6,
            }}
          />
        ))}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-2 !border-bg-surface !bg-accent-purple"
      />
    </motion.div>
  );
});
