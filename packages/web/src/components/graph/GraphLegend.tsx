import { motion } from "framer-motion";
import { getNodeColor } from "@/lib/color-system";
import { NODE_KIND_LABELS } from "@/lib/constants";

interface GraphLegendProps {
  kinds: string[];
  className?: string;
}

export function GraphLegend({ kinds, className = "" }: GraphLegendProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-lg p-3 ${className}`}
    >
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        Legend
      </h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {kinds.map((kind) => (
          <div key={kind} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getNodeColor(kind) }}
            />
            <span className="text-[11px] text-text-secondary">
              {NODE_KIND_LABELS[kind] ?? kind}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
