import { motion } from "framer-motion";
import {
  Eye,
  Pencil,
  Database,
  Key,
  Hash,
} from "lucide-react";
import type { SchemaField } from "@/types/api";

interface FieldSummaryEntry {
  reads: number;
  writes: number;
  total: number;
}

interface FieldImpactListProps {
  fields: SchemaField[];
  impactedFields?: string[];
  fieldSummary?: Record<string, FieldSummaryEntry>;
  onFieldClick?: (field: SchemaField) => void;
  className?: string;
}

export function FieldImpactList({
  fields,
  impactedFields = [],
  fieldSummary = {},
  onFieldClick,
  className = "",
}: FieldImpactListProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Fields
        </span>
        <span className="text-[10px] text-text-muted">
          {impactedFields.length} / {fields.length} referenced
        </span>
      </div>
      {fields.map((field, i) => {
        const isImpacted = impactedFields.includes(field.name);
        const summary = fieldSummary[field.name];
        const typeDisplay = field.type === "unknown" ? "" : field.type;

        return (
          <motion.div
            key={field.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.02 }}
            onClick={() => onFieldClick?.(field)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 transition ${
              onFieldClick ? "cursor-pointer hover:border-accent-blue/40" : ""
            } ${
              isImpacted
                ? "border-accent-blue/20 bg-accent-blue/5"
                : "border-border-default bg-bg-surface"
            }`}
          >
            {/* Icon */}
            <div className="flex h-5 w-5 items-center justify-center flex-shrink-0">
              {field.primaryKey ? (
                <Key className="h-3 w-3 text-accent-amber" />
              ) : field.indexed ? (
                <Hash className="h-3 w-3 text-accent-blue" />
              ) : (
                <Database className="h-3 w-3 text-text-muted/50" />
              )}
            </div>

            {/* Name & type */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-text-primary truncate">
                  {field.name}
                </span>
                {typeDisplay && (
                  <span className="text-[10px] text-accent-purple truncate max-w-[100px]" title={typeDisplay}>
                    {typeDisplay}
                  </span>
                )}
              </div>
            </div>

            {/* Badges & stats */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {field.nullable && (
                <span className="rounded bg-bg-elevated px-1 py-0.5 text-[9px] text-text-muted">
                  null
                </span>
              )}
              {field.primaryKey && (
                <span className="rounded bg-accent-amber/10 px-1 py-0.5 text-[9px] font-medium text-accent-amber">
                  PK
                </span>
              )}
              {field.indexed && (
                <span className="rounded bg-accent-blue/10 px-1 py-0.5 text-[9px] font-medium text-accent-blue">
                  idx
                </span>
              )}
              {summary && summary.total > 0 && (
                <div className="flex items-center gap-1 ml-1">
                  {summary.reads > 0 && (
                    <span className="flex items-center gap-0.5 text-[9px] text-accent-green" title={`${summary.reads} reads`}>
                      <Eye className="h-2.5 w-2.5" />
                      {summary.reads}
                    </span>
                  )}
                  {summary.writes > 0 && (
                    <span className="flex items-center gap-0.5 text-[9px] text-accent-amber" title={`${summary.writes} writes`}>
                      <Pencil className="h-2.5 w-2.5" />
                      {summary.writes}
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
