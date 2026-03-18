import { motion } from "framer-motion";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface MigrationStep {
  type:
    | "add_column"
    | "drop_column"
    | "rename_column"
    | "alter_type"
    | "add_index"
    | "add_constraint";
  table: string;
  column?: string;
  details: string;
  breaking: boolean;
}

interface MigrationPreviewProps {
  steps: MigrationStep[];
  className?: string;
}

const stepIcons = {
  add_column: ArrowUpCircle,
  drop_column: ArrowDownCircle,
  rename_column: RefreshCw,
  alter_type: RefreshCw,
  add_index: ArrowUpCircle,
  add_constraint: ArrowUpCircle,
};

const stepColors = {
  add_column: "text-accent-green",
  drop_column: "text-accent-red",
  rename_column: "text-accent-amber",
  alter_type: "text-accent-amber",
  add_index: "text-accent-blue",
  add_constraint: "text-accent-purple",
};

export function MigrationPreview({
  steps,
  className = "",
}: MigrationPreviewProps) {
  const breakingCount = steps.filter((s) => s.breaking).length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Migration Preview
          </span>
          <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs text-text-secondary">
            {steps.length} step{steps.length !== 1 ? "s" : ""}
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
            Non-breaking
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, i) => {
          const Icon = stepIcons[step.type];
          const color = stepColors[step.type];

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-lg border p-3 ${
                step.breaking
                  ? "border-accent-red/30 bg-accent-red/5"
                  : "border-border-default bg-bg-surface"
              }`}
            >
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${color}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      {step.type.replace(/_/g, " ")}
                    </span>
                    {step.breaking && (
                      <span className="rounded bg-accent-red/10 px-1 py-0.5 text-[10px] font-medium text-accent-red">
                        BREAKING
                      </span>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-xs text-text-primary">
                    <span className="text-accent-purple">{step.table}</span>
                    {step.column && (
                      <>
                        <span className="text-text-muted">.</span>
                        <span className="text-accent-blue">{step.column}</span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {step.details}
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
