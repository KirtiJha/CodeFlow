import { DiffViewer } from "@/components/code/DiffViewer";
import { Badge } from "@/components/shared/Badge";
import type { BranchConflict, ConflictDetail, FileDiff } from "@/types/branch";

interface ConflictDiffProps {
  conflict: BranchConflict;
  diffs?: FileDiff[];
  className?: string;
}

export function ConflictDiff({
  conflict,
  diffs = [],
  className = "",
}: ConflictDiffProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      {/* Conflict header */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">
            {conflict.branch1} ↔ {conflict.branch2}
          </span>
          <Badge variant="severity" value={conflict.severity} />
        </div>
        <span className="text-xs text-text-muted">
          {conflict.details.length} conflict
          {conflict.details.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Details and diffs */}
      <div className="flex-1 overflow-auto">
        {/* Conflict details */}
        <div className="border-b border-border-default p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Conflict Details
          </h4>
          <div className="space-y-2">
            {conflict.details.map((detail, i) => (
              <DetailItem key={i} detail={detail} />
            ))}
          </div>
        </div>

        {/* Diff views */}
        {diffs.length > 0 && (
          <div className="p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              File Changes
            </h4>
            <div className="space-y-4">
              {diffs.map((diff, i) => (
                <DiffViewer key={i} diff={diff} mode="unified" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({ detail }: { detail: ConflictDetail }) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-elevated/30 p-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="kind" value={detail.type} />
            {detail.symbol && (
              <span className="font-mono text-xs text-accent-purple">
                {detail.symbol}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            {detail.description}
          </p>
        </div>
        <span className="text-[10px] text-text-muted">
          {detail.file}
          {detail.line ? `:${detail.line}` : ""}
        </span>
      </div>
      {detail.suggestion && (
        <p className="mt-2 rounded bg-accent-green/5 px-2 py-1 text-[11px] text-accent-green">
          💡 {detail.suggestion}
        </p>
      )}
    </div>
  );
}
