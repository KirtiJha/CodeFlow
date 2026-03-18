import { useMemo } from "react";
import type { FileDiff, DiffHunk, DiffLine } from "@/types/branch";

interface DiffViewerProps {
  diff: FileDiff;
  mode?: "unified" | "split";
  className?: string;
}

export function DiffViewer({
  diff,
  mode = "unified",
  className = "",
}: DiffViewerProps) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-border-default ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default bg-bg-surface px-4 py-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={diff.status} />
          <span className="font-mono text-sm text-text-primary">
            {diff.path}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-400">+{diff.linesAdded}</span>
          <span className="text-red-400">-{diff.linesRemoved}</span>
        </div>
      </div>

      {/* Hunks */}
      <div className="overflow-auto font-mono text-xs leading-5">
        {diff.hunks.map((hunk, i) => (
          <HunkView key={i} hunk={hunk} mode={mode} />
        ))}
      </div>
    </div>
  );
}

function HunkView({
  hunk,
  mode,
}: {
  hunk: DiffHunk;
  mode: "unified" | "split";
}) {
  return (
    <>
      {/* Hunk header */}
      <div className="bg-accent-blue/5 px-4 py-1 text-accent-blue/70">
        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
      </div>

      {mode === "unified" ? (
        <UnifiedLines lines={hunk.lines} />
      ) : (
        <SplitLines lines={hunk.lines} />
      )}
    </>
  );
}

function UnifiedLines({ lines }: { lines: DiffLine[] }) {
  return (
    <div>
      {lines.map((line, i) => (
        <div
          key={i}
          className={`flex ${
            line.type === "add"
              ? "bg-green-500/5"
              : line.type === "remove"
                ? "bg-red-500/5"
                : ""
          }`}
        >
          <span className="w-10 flex-shrink-0 select-none px-2 text-right text-text-muted/50">
            {line.oldLine ?? ""}
          </span>
          <span className="w-10 flex-shrink-0 select-none px-2 text-right text-text-muted/50">
            {line.newLine ?? ""}
          </span>
          <span className="w-4 flex-shrink-0 select-none text-center">
            {line.type === "add" ? (
              <span className="text-green-400">+</span>
            ) : line.type === "remove" ? (
              <span className="text-red-400">-</span>
            ) : (
              " "
            )}
          </span>
          <span className="flex-1 whitespace-pre px-2">{line.content}</span>
        </div>
      ))}
    </div>
  );
}

function SplitLines({ lines }: { lines: DiffLine[] }) {
  const { leftLines, rightLines } = useMemo(() => {
    const left: (DiffLine | null)[] = [];
    const right: (DiffLine | null)[] = [];

    for (const line of lines) {
      if (line.type === "context") {
        left.push(line);
        right.push(line);
      } else if (line.type === "remove") {
        left.push(line);
        right.push(null);
      } else {
        left.push(null);
        right.push(line);
      }
    }

    return { leftLines: left, rightLines: right };
  }, [lines]);

  return (
    <div className="flex">
      <div className="w-1/2 border-r border-border-default">
        {leftLines.map((line, i) => (
          <div
            key={i}
            className={`flex ${line?.type === "remove" ? "bg-red-500/5" : ""}`}
          >
            <span className="w-10 flex-shrink-0 select-none px-2 text-right text-text-muted/50">
              {line?.oldLine ?? ""}
            </span>
            <span className="flex-1 whitespace-pre px-2">
              {line?.content ?? ""}
            </span>
          </div>
        ))}
      </div>
      <div className="w-1/2">
        {rightLines.map((line, i) => (
          <div
            key={i}
            className={`flex ${line?.type === "add" ? "bg-green-500/5" : ""}`}
          >
            <span className="w-10 flex-shrink-0 select-none px-2 text-right text-text-muted/50">
              {line?.newLine ?? ""}
            </span>
            <span className="flex-1 whitespace-pre px-2">
              {line?.content ?? ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    added: "bg-green-500/15 text-green-400",
    modified: "bg-amber-500/15 text-amber-400",
    deleted: "bg-red-500/15 text-red-400",
    renamed: "bg-purple-500/15 text-purple-400",
  };

  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
        colors[status] ?? "bg-gray-500/15 text-gray-400"
      }`}
    >
      {status.charAt(0)}
    </span>
  );
}
