import { motion } from "framer-motion";
import {
  ArrowRight,
  AlertTriangle,
  Database,
} from "lucide-react";
import type { SchemaField } from "@/types/api";

interface FieldImpactListProps {
  fields: SchemaField[];
  impactedFields?: string[];
  className?: string;
}

export function FieldImpactList({
  fields,
  impactedFields = [],
  className = "",
}: FieldImpactListProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {fields.map((field, i) => {
        const isImpacted = impactedFields.includes(field.name);

        return (
          <motion.div
            key={field.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
              isImpacted
                ? "border-accent-amber/30 bg-accent-amber/5"
                : "border-border-default bg-bg-surface"
            }`}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded">
              {isImpacted ? (
                <AlertTriangle className="h-3.5 w-3.5 text-accent-amber" />
              ) : (
                <Database className="h-3.5 w-3.5 text-text-muted" />
              )}
            </div>

            <div className="flex-1 overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-text-primary">
                  {field.name}
                </span>
                <span className="text-xs text-text-muted">{field.type}</span>
              </div>
              {field.references && field.references.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-text-muted">
                  <ArrowRight className="h-3 w-3" />
                  <span>{field.references.length} reference{field.references.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {field.nullable && (
                <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
                  nullable
                </span>
              )}
              {field.primaryKey && (
                <span className="rounded bg-accent-purple/10 px-1.5 py-0.5 text-[10px] text-accent-purple">
                  PK
                </span>
              )}
              {field.indexed && (
                <span className="rounded bg-accent-blue/10 px-1.5 py-0.5 text-[10px] text-accent-blue">
                  indexed
                </span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
