import { motion } from "framer-motion";
import {
  AlertTriangle,
  FileCode,
  Code2,
  Fingerprint,
  Brain,
  Database,
} from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { formatRelativeTime } from "@/lib/formatters";
import type { BranchConflict, ConflictLevel } from "@/types/branch";

interface ConflictCardProps {
  conflict: BranchConflict;
  onClick?: () => void;
  selected?: boolean;
}

const levelIcons: Record<ConflictLevel, typeof FileCode> = {
  file: FileCode,
  symbol: Code2,
  signature: Fingerprint,
  semantic: Brain,
  schema: Database,
};

const levelLabels: Record<ConflictLevel, string> = {
  file: "File Overlap",
  symbol: "Symbol Conflict",
  signature: "Signature Change",
  semantic: "Semantic Conflict",
  schema: "Schema/Contract",
};

export function ConflictCard({
  conflict,
  onClick,
  selected,
}: ConflictCardProps) {
  const LevelIcon = levelIcons[conflict.level];
  const isCritical = conflict.severity === "critical";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className={`cursor-pointer rounded-xl border p-4 transition-all ${
        selected
          ? "border-accent-blue bg-accent-blue/5"
          : "border-border-default bg-bg-surface hover:border-border-focus"
      } ${isCritical ? "pulse-critical" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated">
            <LevelIcon className="h-4 w-4 text-text-secondary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">
                {conflict.branch1}
              </span>
              <span className="text-xs text-text-muted">↔</span>
              <span className="text-sm font-semibold text-text-primary">
                {conflict.branch2}
              </span>
            </div>
            <span className="text-xs text-text-muted">
              {levelLabels[conflict.level]}
            </span>
          </div>
        </div>
        <Badge
          variant="severity"
          value={conflict.severity}
          pulse={isCritical}
        />
      </div>

      {/* Details preview */}
      <div className="mt-3 space-y-1.5">
        {conflict.details.slice(0, 3).map((detail, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-md bg-bg-elevated/50 px-2 py-1 text-xs"
          >
            <AlertTriangle className="h-3 w-3 flex-shrink-0 text-text-muted" />
            <span className="truncate text-text-secondary">
              {detail.description}
            </span>
          </div>
        ))}
        {conflict.details.length > 3 && (
          <span className="text-[10px] text-text-muted">
            +{conflict.details.length - 3} more
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 text-[10px] text-text-muted">
        Detected {formatRelativeTime(conflict.detectedAt)}
      </div>
    </motion.div>
  );
}
