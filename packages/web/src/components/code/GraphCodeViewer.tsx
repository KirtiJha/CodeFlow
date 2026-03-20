import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { codeToHtml } from "shiki";
import {
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  Zap,
  TestTube2,
  DoorOpen,
  FileCode,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";
import { Skeleton } from "@/components/shared/LoadingSpinner";
import type { NodeDetailResponse } from "@/lib/api-client";

const NODE_KIND_COLORS: Record<string, string> = {
  function: "#3b82f6",
  method: "#60a5fa",
  class: "#8b5cf6",
  interface: "#a78bfa",
  type_alias: "#ec4899",
  variable: "#06b6d4",
  constant: "#22d3ee",
  file: "#6366f1",
  import: "#f472b6",
  export: "#f9a8d4",
  constructor: "#10b981",
  test: "#84cc16",
  enum: "#c4b5fd",
  arrow_function: "#93c5fd",
};

const EDGE_KIND_LABELS: Record<string, string> = {
  calls: "calls",
  imports: "imports",
  extends: "extends",
  implements: "implements",
  uses: "uses",
  defines: "defines",
  contains: "contains",
  overrides: "overrides",
  data_flow: "data flow",
  test_covers: "tests",
  taint: "taint flow",
};

interface GraphCodeViewerProps {
  detail: NodeDetailResponse;
  onNodeNavigate?: (nodeId: string) => void;
  onClose?: () => void;
  className?: string;
}

export function GraphCodeViewer({
  detail,
  onNodeNavigate,
  onClose,
  className = "",
}: GraphCodeViewerProps) {
  const { node, fileContent, siblings, callees, callers } = detail;
  const [html, setHtml] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeNavNodeId, setActiveNavNodeId] = useState<string | null>(null);
  const [showCallers, setShowCallers] = useState(true);
  const [showCallees, setShowCallees] = useState(true);
  const codeRef = useRef<HTMLDivElement>(null);
  const navFlashTimerRef = useRef<number | null>(null);
  const { codeTheme } = useSettingsStore((s) => s.display);

  // Build a line → sibling node(s) lookup
  const lineNodeMap = useMemo(() => {
    const map = new Map<number, typeof siblings>();
    for (const s of siblings) {
      if (s.line > 0) {
        const existing = map.get(s.line) ?? [];
        existing.push(s);
        map.set(s.line, existing);
      }
    }
    return map;
  }, [siblings]);



  // Syntax highlighting
  useEffect(() => {
    if (!fileContent) return;
    let cancelled = false;

    async function highlight() {
      setIsLoading(true);
      try {
        const lang = mapLanguage(node.language);
        const result = await codeToHtml(fileContent, {
          lang,
          theme: (codeTheme as "github-dark") || "github-dark",
          transformers: [
            {
              line(hNode, line) {
                // Highlight the selected node's definition lines
                if (
                  line >= node.line &&
                  line <= (node.endLine || node.line)
                ) {
                  this.addClassToHast(hNode, "gcv-active-line");
                }
                // Mark lines where sibling nodes start
                if (lineNodeMap.has(line) && line !== node.line) {
                  this.addClassToHast(hNode, "gcv-sibling-line");
                }
              },
            },
          ],
        });
        if (!cancelled) {
          setHtml(result);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setHtml(
            `<pre><code>${fileContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`,
          );
          setIsLoading(false);
        }
      }
    }

    highlight();
    return () => {
      cancelled = true;
    };
  }, [fileContent, node, codeTheme, lineNodeMap]);

  // Auto-scroll to the active line
  useEffect(() => {
    if (!isLoading && codeRef.current) {
      requestAnimationFrame(() => {
        const activeLine = codeRef.current?.querySelector(".gcv-active-line");
        activeLine?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [isLoading, html]);

  const handleSymbolClick = useCallback(
    (nodeId: string) => {
      setActiveNavNodeId(nodeId);
      if (navFlashTimerRef.current) {
        clearTimeout(navFlashTimerRef.current);
      }
      navFlashTimerRef.current = window.setTimeout(() => {
        setActiveNavNodeId((current) => (current === nodeId ? null : current));
      }, 1200);
      onNodeNavigate?.(nodeId);
    },
    [onNodeNavigate],
  );

  useEffect(() => {
    return () => {
      if (navFlashTimerRef.current) {
        clearTimeout(navFlashTimerRef.current);
      }
    };
  }, []);

  // Compute relationship groups for the summary
  const calleesByKind = useMemo(() => {
    const groups = new Map<string, typeof callees>();
    for (const c of callees) {
      const key = c.edgeKind;
      const arr = groups.get(key) ?? [];
      arr.push(c);
      groups.set(key, arr);
    }
    return groups;
  }, [callees]);

  const callersByKind = useMemo(() => {
    const groups = new Map<string, typeof callers>();
    for (const c of callers) {
      const key = c.edgeKind;
      const arr = groups.get(key) ?? [];
      arr.push(c);
      groups.set(key, arr);
    }
    return groups;
  }, [callers]);

  return (
    <div className={`flex h-full flex-col overflow-hidden ${className}`}>
      {/* ═══ Node Identity Header ═══ */}
      <div className="border-b border-border-default bg-bg-base/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: NODE_KIND_COLORS[node.kind] ?? "#6b7280",
            }}
          />
          <span className="text-sm font-semibold text-text-primary truncate">
            {node.qualifiedName ?? node.name}
          </span>
          <span className="rounded-full border border-border-default bg-bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
            {node.kind}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-auto shrink-0 rounded p-1 text-text-muted hover:bg-bg-surface hover:text-text-primary transition-colors"
              title="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {node.isTest && (
            <span className="flex items-center gap-0.5 rounded-full bg-lime-500/10 px-1.5 py-0.5 text-[10px] text-lime-400">
              <TestTube2 className="h-3 w-3" /> test
            </span>
          )}
          {node.isEntryPoint && (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">
              <DoorOpen className="h-3 w-3" /> entry
            </span>
          )}
        </div>

        {/* File + metrics row */}
        <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <FileCode className="h-3 w-3" />
            {node.file}:{node.line}
          </span>
          {node.complexity > 0 && (
            <span
              className={`flex items-center gap-0.5 ${node.complexity > 10 ? "text-amber-400" : ""}`}
            >
              <Zap className="h-3 w-3" /> complexity: {node.complexity}
            </span>
          )}
          {node.riskScore > 0 && node.riskScore !== 33 && (
            <span
              className={`flex items-center gap-0.5 ${node.riskScore > 50 ? "text-red-400" : ""}`}
            >
              <AlertTriangle className="h-3 w-3" /> risk: {node.riskScore}
            </span>
          )}
          {node.riskScore === 33 && (
            <span
              className="flex items-center gap-0.5 text-text-muted/50"
              title="Default score — no detailed analysis data available"
            >
              <AlertTriangle className="h-3 w-3" /> risk: ~{node.riskScore}
            </span>
          )}
          {node.signature && (
            <code className="rounded bg-bg-surface px-1.5 font-mono text-[11px] text-text-secondary">
              {node.signature}
            </code>
          )}
        </div>
      </div>

      {/* ═══ Relationship Panels ═══ */}
      {(callers.length > 0 || callees.length > 0) && (
        <div className="border-b border-border-default bg-bg-surface/30">
          {/* Callers (incoming) */}
          {callers.length > 0 && (
            <div>
              <button
                onClick={() => setShowCallers(!showCallers)}
                className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs font-medium text-text-secondary hover:bg-bg-surface/50"
              >
                {showCallers ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <ArrowDownLeft className="h-3 w-3 text-emerald-400" />
                <span>
                  {callers.length} caller{callers.length !== 1 ? "s" : ""}
                </span>
              </button>
              {showCallers && (
                <div className="flex flex-wrap gap-1 px-4 pb-2">
                  {[...callersByKind.entries()].map(([edgeKind, nodes]) => (
                    <div key={edgeKind} className="flex flex-wrap gap-1">
                      {nodes.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleSymbolClick(n.id)}
                          className={`group inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] transition-all ${
                            activeNavNodeId === n.id
                              ? "border-amber-400/70 bg-amber-500/15 ring-1 ring-amber-300/60"
                              : "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-400/40 hover:bg-emerald-500/10"
                          }`}
                        >
                          <div
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              backgroundColor:
                                NODE_KIND_COLORS[n.kind] ?? "#6b7280",
                            }}
                          />
                          <span className="text-emerald-300 group-hover:text-emerald-200">
                            {n.name}
                          </span>
                          <span className="text-emerald-500/50">
                            {EDGE_KIND_LABELS[edgeKind] ?? edgeKind}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Callees (outgoing) */}
          {callees.length > 0 && (
            <div>
              <button
                onClick={() => setShowCallees(!showCallees)}
                className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs font-medium text-text-secondary hover:bg-bg-surface/50"
              >
                {showCallees ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <ArrowUpRight className="h-3 w-3 text-blue-400" />
                <span>
                  {callees.length} dependenc{callees.length !== 1 ? "ies" : "y"}
                </span>
              </button>
              {showCallees && (
                <div className="flex flex-wrap gap-1 px-4 pb-2">
                  {[...calleesByKind.entries()].map(([edgeKind, nodes]) => (
                    <div key={edgeKind} className="flex flex-wrap gap-1">
                      {nodes.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleSymbolClick(n.id)}
                          className={`group inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] transition-all ${
                            activeNavNodeId === n.id
                              ? "border-amber-400/70 bg-amber-500/15 ring-1 ring-amber-300/60"
                              : "border-blue-500/20 bg-blue-500/5 hover:border-blue-400/40 hover:bg-blue-500/10"
                          }`}
                        >
                          <div
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              backgroundColor:
                                NODE_KIND_COLORS[n.kind] ?? "#6b7280",
                            }}
                          />
                          <span className="text-blue-300 group-hover:text-blue-200">
                            {n.name}
                          </span>
                          <span className="text-blue-500/50">
                            {EDGE_KIND_LABELS[edgeKind] ?? edgeKind}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ File Symbols Gutter ═══ */}
      {siblings.length > 1 && (
        <div className="border-b border-border-default px-4 py-1.5">
          <div className="flex items-center gap-1 overflow-x-auto text-[10px]">
            <span className="shrink-0 text-text-muted">
              {siblings.length} symbols:
            </span>
            {siblings
              .filter((s) => s.kind !== "file" && s.kind !== "import" && s.kind !== "export")
              .slice(0, 25)
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSymbolClick(s.id)}
                  className={`shrink-0 rounded px-1.5 py-0.5 transition-all hover:brightness-125 ${
                    s.id === node.id
                      ? "ring-1 ring-white/30 brightness-125"
                      : activeNavNodeId === s.id
                        ? "ring-1 ring-amber-300/70"
                      : ""
                  }`}
                  style={{
                    backgroundColor: `${NODE_KIND_COLORS[s.kind] ?? "#6b7280"}20`,
                    color: NODE_KIND_COLORS[s.kind] ?? "#6b7280",
                  }}
                  title={`${s.kind}: ${s.name} (line ${s.line})`}
                >
                  {s.name}
                </button>
              ))}
            {siblings.filter((s) => s.kind !== "file" && s.kind !== "import" && s.kind !== "export").length > 25 && (
              <span className="shrink-0 text-text-muted">
                +{siblings.filter((s) => s.kind !== "file" && s.kind !== "import" && s.kind !== "export").length - 25} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* ═══ Code View with Gutter Annotations ═══ */}
      <div ref={codeRef} className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4">
            <Skeleton lines={20} />
          </div>
        ) : (
          <div className="relative">
            <style>{`
              .gcv-active-line {
                background: rgba(59, 130, 246, 0.12) !important;
                border-left: 3px solid #3b82f6 !important;
              }
              .gcv-sibling-line {
                border-left: 3px solid rgba(139, 92, 246, 0.3) !important;
              }
              .shiki {
                padding: 0.75rem 0.75rem 0.75rem 2.5rem;
                margin: 0;
                font-family: 'JetBrains Mono', 'Fira Code', monospace;
                font-size: 12.5px;
                line-height: 1.6;
                counter-reset: line-number ${(node.line > 1 ? 0 : 0)};
              }
              .shiki code {
                counter-reset: line-number;
              }
              .shiki .line {
                position: relative;
                padding-left: 0.5rem;
              }
              .shiki .line::before {
                counter-increment: line-number;
                content: counter(line-number);
                position: absolute;
                left: -2rem;
                width: 1.5rem;
                text-align: right;
                color: #4b5563;
                font-size: 11px;
              }
            `}</style>
            {/* Gutter annotations overlaid on code */}
            <GutterAnnotations
              siblings={siblings}
              currentNodeId={node.id}
              onSymbolClick={handleSymbolClick}
            />
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Floating gutter markers for each sibling symbol definition */
function GutterAnnotations({
  siblings,
  currentNodeId,
  onSymbolClick,
}: {
  siblings: NodeDetailResponse["siblings"];
  currentNodeId: string;
  onSymbolClick: (id: string) => void;
}) {
  // We show a tiny annotation dot in the gutter for each sibling's start line
  // These are positioned absolutely based on line height (1.6 * 12.5px ≈ 20px per line)
  const lineHeight = 20;
  const topPadding = 12; // matches .shiki padding-top 0.75rem

  return (
    <div className="pointer-events-none absolute left-0 top-0 z-10 w-6">
      {siblings
        .filter((s) => s.kind !== "file" && s.kind !== "import" && s.line > 0)
        .map((s) => {
          const top = topPadding + (s.line - 1) * lineHeight;
          const isCurrent = s.id === currentNodeId;
          const color = NODE_KIND_COLORS[s.kind] ?? "#6b7280";
          return (
            <div
              key={s.id}
              className="pointer-events-auto absolute left-1 cursor-pointer"
              style={{ top }}
              title={`${s.kind}: ${s.name}`}
              onClick={() => onSymbolClick(s.id)}
            >
              <div
                className={`h-2 w-2 rounded-full transition-transform ${isCurrent ? "scale-150 ring-1 ring-white/40" : "hover:scale-125"}`}
                style={{ backgroundColor: color }}
              />
            </div>
          );
        })}
    </div>
  );
}

function mapLanguage(lang: string): string {
  const map: Record<string, string> = {
    typescript: "typescript",
    javascript: "javascript",
    python: "python",
    java: "java",
    go: "go",
    rust: "rust",
    ruby: "ruby",
    csharp: "csharp",
    cpp: "cpp",
    c: "c",
    swift: "swift",
    kotlin: "kotlin",
    php: "php",
    tsx: "tsx",
    jsx: "jsx",
    json: "json",
    yaml: "yaml",
    sql: "sql",
  };
  return map[lang.toLowerCase()] ?? "text";
}
