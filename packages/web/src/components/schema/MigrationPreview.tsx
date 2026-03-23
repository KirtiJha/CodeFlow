import { motion } from "framer-motion";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Pencil,
  GitBranch,
  Code,
  FileSearch,
  Link2,
} from "lucide-react";

interface MigrationStep {
  type: string;
  table?: string;
  column?: string;
  details?: string;
  description?: string;
  breaking?: boolean;
}

interface MigrationPreviewProps {
  steps: MigrationStep[];
  onStepClick?: (step: MigrationStep) => void;
  className?: string;
}

const stepIcons: Record<string, typeof CheckCircle2> = {
  add_column: ArrowUpCircle,
  drop_column: ArrowDownCircle,
  rename_column: RefreshCw,
  alter_type: RefreshCw,
  add_index: ArrowUpCircle,
  add_constraint: ArrowUpCircle,
  update_code: Code,
  update_tests: FileSearch,
  update_references: Link2,
  review_references: Eye,
  review_writes: Pencil,
  review_relationships: GitBranch,
  analysis: CheckCircle2,
};

const stepColors: Record<string, string> = {
  add_column: "text-accent-green",
  drop_column: "text-accent-red",
  rename_column: "text-accent-amber",
  alter_type: "text-accent-amber",
  add_index: "text-accent-blue",
  add_constraint: "text-accent-purple",
  update_code: "text-accent-blue",
  update_tests: "text-accent-amber",
  update_references: "text-accent-purple",
  review_references: "text-accent-blue",
  review_writes: "text-accent-amber",
  review_relationships: "text-accent-purple",
  analysis: "text-text-muted",
};

export function MigrationPreview({
  steps,
  onStepClick,
  className = "",
}: MigrationPreviewProps) {
  const breakingCount = steps.filter((s) => s.breaking === true).length;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Impact Analysis
          </span>
          <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs text-text-secondary">
            {steps.length} finding{steps.length !== 1 ? "s" : ""}
          </span>
        </div>
        {breakingCount > 0 ? (
          <div className="flex items-center gap-1 text-xs text-accent-red">
            <AlertTriangle className="h-3.5 w-3.5" />
            {breakingCount} breaking
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-accent-green">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Safe to modify
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const Icon = stepIcons[step.type] ?? CheckCircle2;
          const color = stepColors[step.type] ?? "text-text-muted";

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onStepClick?.(step)}
              className={`rounded-lg border p-2.5 transition ${
                onStepClick ? "cursor-pointer hover:border-accent-blue/40" : ""
              } ${
                step.breaking === true
                  ? "border-accent-red/30 bg-accent-red/5"
                  : "border-border-default bg-bg-surface"
              }`}
            >
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${color}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      {step.type.replace(/_/g, " ")}
                    </span>
                    {step.breaking === true && (
                      <span className="rounded bg-accent-red/10 px-1 py-0.5 text-[9px] font-medium text-accent-red">
                        BREAKING
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {step.details ?? step.description}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
