import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, FileCode } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import type { TestInfo } from "@/types/api";

interface TestListProps {
  tests: TestInfo[];
  selectedTestId?: string | null;
  onSelect?: (test: TestInfo) => void;
  className?: string;
}

const statusConfig = {
  passing: {
    icon: CheckCircle2,
    color: "text-accent-green",
    bg: "bg-accent-green/10",
  },
  failing: { icon: XCircle, color: "text-accent-red", bg: "bg-accent-red/10" },
  pending: {
    icon: Clock,
    color: "text-accent-amber",
    bg: "bg-accent-amber/10",
  },
};

export function TestList({
  tests,
  selectedTestId,
  onSelect,
  className = "",
}: TestListProps) {
  if (tests.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-text-muted">
        No affected tests found
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {tests.map((test, i) => {
        const status =
          statusConfig[test.status as keyof typeof statusConfig] ??
          statusConfig.pending;
        const StatusIcon = status.icon;
        const isSelected = test.id === selectedTestId;

        return (
          <motion.button
            key={test.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onSelect?.(test)}
            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
              isSelected
                ? "border-accent-blue bg-accent-blue/5"
                : "border-transparent hover:border-border-default hover:bg-bg-surface"
            }`}
          >
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-md ${status.bg}`}
            >
              <StatusIcon className={`h-4 w-4 ${status.color}`} />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="truncate text-sm font-medium text-text-primary">
                {test.name}
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <FileCode className="h-3 w-3" />
                <span className="truncate">{test.file}</span>
                {test.line && <span>:{test.line}</span>}
              </div>
            </div>
            <Badge variant="kind" value={test.type ?? "unit"} />
          </motion.button>
        );
      })}
    </div>
  );
}
