import { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Eye,
  Pencil,
  GitBranch,
  FileCode,
  Key,
  Hash,
  Database,
  ArrowRight,
  ExternalLink,
  Code2,
  Layers,
} from "lucide-react";

/* ── Shared types ──────────────────────────────────────────────── */

export interface CodeRef {
  file: string;
  line: number;
  kind: string;
  symbol: string;
}

export interface FieldSummaryEntry {
  reads: number;
  writes: number;
  total: number;
}

export interface Relationship {
  from: string;
  to: string;
  field: string;
  type: string;
}

export type ModalView =
  | { kind: "reads"; refs: CodeRef[] }
  | { kind: "writes"; refs: CodeRef[] }
  | { kind: "relations"; relationships: Relationship[]; modelName: string }
  | { kind: "field"; fieldName: string; type: string; refs: CodeRef[]; summary: FieldSummaryEntry | null; isPK?: boolean; isIndexed?: boolean; nullable?: boolean }
  | { kind: "finding"; step: { type: string; description: string; breaking: boolean }; refs: CodeRef[]; relationships?: Relationship[]; modelName?: string };

interface SchemaDetailModalProps {
  view: ModalView | null;
  onClose: () => void;
}

/* ── Helpers ───────────────────────────────────────────────────── */

function shortPath(file: string): string {
  const parts = file.split("/");
  return parts.length > 2 ? parts.slice(-3).join("/") : file;
}

function shortName(qualified: string): string {
  const i = qualified.lastIndexOf("::");
  return i >= 0 ? qualified.slice(i + 2) : qualified;
}

const REL_COLORS: Record<string, string> = {
  foreign_key: "text-accent-purple",
  has_many: "text-accent-amber",
  belongs_to: "text-accent-blue",
};

const REL_LABELS: Record<string, string> = {
  foreign_key: "Foreign Key",
  has_many: "Has Many",
  belongs_to: "Belongs To",
};

/* ── Main modal component ──────────────────────────────────────── */

export const SchemaDetailModal = memo(function SchemaDetailModal({
  view,
  onClose,
}: SchemaDetailModalProps) {
  if (!view) return null;

  return (
    <AnimatePresence>
      {view && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed inset-x-4 top-[10%] bottom-[10%] z-50 mx-auto flex max-w-2xl flex-col rounded-2xl border border-border-default bg-bg-surface shadow-2xl shadow-black/50 overflow-hidden"
          >
            <ModalContent view={view} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

/* ── Modal content router ──────────────────────────────────────── */

function ModalContent({
  view,
  onClose,
}: {
  view: ModalView;
  onClose: () => void;
}) {
  switch (view.kind) {
    case "reads":
      return <RefsView title="Read References" icon={<Eye className="h-4 w-4 text-accent-blue" />} refs={view.refs} filterKind="read" onClose={onClose} />;
    case "writes":
      return <RefsView title="Write References" icon={<Pencil className="h-4 w-4 text-accent-amber" />} refs={view.refs} filterKind="write" onClose={onClose} />;
    case "relations":
      return <RelationsView relationships={view.relationships} modelName={view.modelName} onClose={onClose} />;
    case "field":
      return <FieldDetailView {...view} onClose={onClose} />;
    case "finding":
      return <FindingDetailView step={view.step} refs={view.refs} relationships={view.relationships} modelName={view.modelName} onClose={onClose} />;
  }
}

/* ── Header ────────────────────────────────────────────────────── */

function ModalHeader({
  title,
  subtitle,
  icon,
  badge,
  onClose,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  badge?: { label: string; color: string };
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border-default px-5 py-3.5 bg-bg-elevated/50">
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {title}
            </h3>
            {badge && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.color}`}>
                {badge.label}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="text-[11px] text-text-muted truncate mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        className="rounded-lg p-1.5 text-text-muted transition hover:bg-bg-elevated hover:text-text-primary"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ── Refs view (Reads / Writes) ────────────────────────────────── */

function RefsView({
  title,
  icon,
  refs,
  filterKind,
  onClose,
}: {
  title: string;
  icon: React.ReactNode;
  refs: CodeRef[];
  filterKind: string;
  onClose: () => void;
}) {
  const filtered = useMemo(() => {
    if (filterKind === "read")
      return refs.filter((r) => r.kind === "read" || r.kind === "query");
    if (filterKind === "write")
      return refs.filter((r) => r.kind === "write" || r.kind === "migration");
    return refs;
  }, [refs, filterKind]);

  // Group by file
  const grouped = useMemo(() => {
    const map = new Map<string, CodeRef[]>();
    for (const r of filtered) {
      if (!map.has(r.file)) map.set(r.file, []);
      map.get(r.file)!.push(r);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  return (
    <>
      <ModalHeader
        title={title}
        subtitle={`${filtered.length} reference${filtered.length !== 1 ? "s" : ""} across ${grouped.length} file${grouped.length !== 1 ? "s" : ""}`}
        icon={icon}
        onClose={onClose}
      />
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {grouped.map(([file, fileRefs]) => (
          <div key={file} className="rounded-lg border border-border-default overflow-hidden">
            <div className="flex items-center gap-2 bg-bg-elevated px-3 py-2">
              <FileCode className="h-3 w-3 text-text-muted flex-shrink-0" />
              <span className="text-[11px] font-mono text-text-secondary truncate">
                {shortPath(file)}
              </span>
              <span className="ml-auto text-[10px] text-text-muted flex-shrink-0">
                {fileRefs.length}
              </span>
            </div>
            <div className="divide-y divide-border-subtle">
              {fileRefs.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-1.5 text-[11px] hover:bg-bg-elevated/30 transition"
                >
                  <span className="font-mono text-text-muted w-10 text-right flex-shrink-0">
                    :{r.line}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                    r.kind === "write" || r.kind === "migration"
                      ? "bg-accent-amber/10 text-accent-amber"
                      : "bg-accent-blue/10 text-accent-blue"
                  }`}>
                    {r.kind}
                  </span>
                  <span className="font-mono text-text-primary truncate">
                    {r.symbol}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-text-muted">
            No references found
          </div>
        )}
      </div>
    </>
  );
}

/* ── Relations view ────────────────────────────────────────────── */

function RelationsView({
  relationships,
  modelName,
  onClose,
}: {
  relationships: Relationship[];
  modelName: string;
  onClose: () => void;
}) {
  return (
    <>
      <ModalHeader
        title="Model Relationships"
        subtitle={`${relationships.length} connection${relationships.length !== 1 ? "s" : ""} for ${shortName(modelName)}`}
        icon={<GitBranch className="h-4 w-4 text-accent-purple" />}
        onClose={onClose}
      />
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {relationships.map((rel, i) => {
          const isFrom = rel.from === modelName;
          const other = isFrom ? rel.to : rel.from;
          const color = REL_COLORS[rel.type] ?? "text-text-secondary";
          const label = REL_LABELS[rel.type] ?? rel.type.replace(/_/g, " ");

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-lg border border-border-default bg-bg-surface p-3.5"
            >
              <div className="flex items-center gap-3">
                {/* Direction */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-xs font-mono text-accent-blue font-semibold truncate">
                    {shortName(modelName)}
                  </span>
                  <ArrowRight className="h-3 w-3 text-text-muted flex-shrink-0" />
                  <span className="text-xs font-mono text-accent-purple font-semibold truncate">
                    {shortName(other)}
                  </span>
                </div>

                {/* Type badge */}
                <span className={`rounded-full border border-border-default px-2 py-0.5 text-[10px] font-medium ${color}`}>
                  {label}
                </span>
              </div>

              {/* Via field */}
              <div className="mt-2 flex items-center gap-2 text-[10px] text-text-muted">
                <span>via field:</span>
                <span className="font-mono text-text-secondary font-medium">
                  {rel.field}
                </span>
              </div>
            </motion.div>
          );
        })}
        {relationships.length === 0 && (
          <div className="py-8 text-center text-xs text-text-muted">
            No relationships detected
          </div>
        )}
      </div>
    </>
  );
}

/* ── Field detail view ─────────────────────────────────────────── */

function FieldDetailView({
  fieldName,
  type,
  refs,
  summary,
  isPK,
  isIndexed,
  nullable,
  onClose,
}: {
  fieldName: string;
  type: string;
  refs: CodeRef[];
  summary: FieldSummaryEntry | null;
  isPK?: boolean;
  isIndexed?: boolean;
  nullable?: boolean;
  onClose: () => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, CodeRef[]>();
    for (const r of refs) {
      if (!map.has(r.file)) map.set(r.file, []);
      map.get(r.file)!.push(r);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [refs]);

  const typeDisplay = type === "unknown" ? "—" : type;

  return (
    <>
      <ModalHeader
        title={fieldName}
        subtitle={`Type: ${typeDisplay}`}
        icon={
          isPK ? (
            <Key className="h-4 w-4 text-accent-amber" />
          ) : isIndexed ? (
            <Hash className="h-4 w-4 text-accent-blue" />
          ) : (
            <Database className="h-4 w-4 text-text-muted" />
          )
        }
        badge={
          isPK
            ? { label: "Primary Key", color: "bg-accent-amber/10 text-accent-amber" }
            : isIndexed
              ? { label: "Indexed", color: "bg-accent-blue/10 text-accent-blue" }
              : nullable
                ? { label: "Nullable", color: "bg-bg-elevated text-text-muted" }
                : undefined
        }
        onClose={onClose}
      />

      {/* Stats bar */}
      {summary && summary.total > 0 && (
        <div className="border-b border-border-default px-5 py-3 bg-bg-elevated/30">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-accent-blue">
                {summary.reads}
              </div>
              <div className="text-[10px] text-text-muted">Reads</div>
            </div>
            <div>
              <div className="text-lg font-bold text-accent-amber">
                {summary.writes}
              </div>
              <div className="text-[10px] text-text-muted">Writes</div>
            </div>
            <div>
              <div className="text-lg font-bold text-text-secondary">
                {summary.total}
              </div>
              <div className="text-[10px] text-text-muted">Total</div>
            </div>
          </div>
        </div>
      )}

      {/* Reference list */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
          Code References
        </div>
        {grouped.map(([file, fileRefs]) => (
          <div key={file} className="rounded-lg border border-border-default overflow-hidden">
            <div className="flex items-center gap-2 bg-bg-elevated px-3 py-2">
              <FileCode className="h-3 w-3 text-text-muted flex-shrink-0" />
              <span className="text-[11px] font-mono text-text-secondary truncate">
                {shortPath(file)}
              </span>
              <span className="ml-auto text-[10px] text-text-muted">
                {fileRefs.length}
              </span>
            </div>
            <div className="divide-y divide-border-subtle">
              {fileRefs.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-1.5 text-[11px] hover:bg-bg-elevated/30 transition"
                >
                  <span className="font-mono text-text-muted w-10 text-right flex-shrink-0">
                    :{r.line}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                    r.kind === "write" || r.kind === "migration"
                      ? "bg-accent-amber/10 text-accent-amber"
                      : "bg-accent-blue/10 text-accent-blue"
                  }`}>
                    {r.kind}
                  </span>
                  <span className="font-mono text-text-primary truncate">
                    {r.symbol}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {refs.length === 0 && (
          <div className="py-8 text-center text-xs text-text-muted">
            No code references found for this field
          </div>
        )}
      </div>
    </>
  );
}

/* ── Finding detail view ───────────────────────────────────────── */

function FindingDetailView({
  step,
  refs,
  relationships,
  modelName,
  onClose,
}: {
  step: { type: string; description: string; breaking: boolean };
  refs: CodeRef[];
  relationships?: Relationship[];
  modelName?: string;
  onClose: () => void;
}) {
  const typeLabel = step.type.replace(/_/g, " ");

  // Filter refs based on finding type
  const filtered = useMemo(() => {
    if (step.type === "review_writes")
      return refs.filter((r) => r.kind === "write" || r.kind === "migration");
    if (step.type === "review_references")
      return refs;
    return refs;
  }, [refs, step.type]);

  const grouped = useMemo(() => {
    const map = new Map<string, CodeRef[]>();
    for (const r of filtered) {
      if (!map.has(r.file)) map.set(r.file, []);
      map.get(r.file)!.push(r);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  return (
    <>
      <ModalHeader
        title={typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)}
        subtitle={step.description}
        icon={<Layers className="h-4 w-4 text-accent-blue" />}
        badge={
          step.breaking
            ? { label: "BREAKING", color: "bg-accent-red/10 text-accent-red" }
            : { label: "Safe", color: "bg-accent-green/10 text-accent-green" }
        }
        onClose={onClose}
      />

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {step.type === "review_relationships" && relationships && relationships.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Relationships
              </span>
              <span className="text-[10px] text-text-muted">
                {relationships.length} connection{relationships.length !== 1 ? "s" : ""}
              </span>
            </div>
            {relationships.map((rel, i) => {
              const mName = modelName ?? rel.from;
              const other = rel.from === mName ? rel.to : rel.from;
              const color = REL_COLORS[rel.type] ?? "text-text-secondary";
              const label = REL_LABELS[rel.type] ?? rel.type.replace(/_/g, " ");
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-lg border border-border-default bg-bg-surface p-3.5 mb-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs font-mono text-accent-blue font-semibold truncate">
                        {shortName(mName)}
                      </span>
                      <ArrowRight className="h-3 w-3 text-text-muted flex-shrink-0" />
                      <span className="text-xs font-mono text-accent-purple font-semibold truncate">
                        {shortName(other)}
                      </span>
                    </div>
                    <span className={`rounded-full border border-border-default px-2 py-0.5 text-[10px] font-medium ${color}`}>
                      {label}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-text-muted">
                    <span>via field:</span>
                    <span className="font-mono text-text-secondary font-medium">{rel.field}</span>
                  </div>
                </motion.div>
              );
            })}
          </>
        ) : step.type === "review_relationships" ? (
          <div className="py-8 text-center text-xs text-text-muted">
            No relationships detected
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Affected Locations
              </span>
              <span className="text-[10px] text-text-muted">
                {filtered.length} reference{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
            {grouped.map(([file, fileRefs]) => (
              <div key={file} className="rounded-lg border border-border-default overflow-hidden">
                <div className="flex items-center gap-2 bg-bg-elevated px-3 py-2">
                  <FileCode className="h-3 w-3 text-text-muted flex-shrink-0" />
                  <span className="text-[11px] font-mono text-text-secondary truncate">
                    {shortPath(file)}
                  </span>
                  <span className="ml-auto text-[10px] text-text-muted">
                    {fileRefs.length}
                  </span>
                </div>
                <div className="divide-y divide-border-subtle">
                  {fileRefs.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-1.5 text-[11px] hover:bg-bg-elevated/30 transition"
                    >
                      <span className="font-mono text-text-muted w-10 text-right flex-shrink-0">
                        :{r.line}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                        r.kind === "write" || r.kind === "migration"
                          ? "bg-accent-amber/10 text-accent-amber"
                          : "bg-accent-blue/10 text-accent-blue"
                      }`}>
                        {r.kind}
                      </span>
                      <span className="font-mono text-text-primary truncate">
                        {r.symbol}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-8 text-center text-xs text-text-muted">
                No matching references
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
