import { useEffect, useState, useRef, useMemo } from "react";
import { codeToHtml } from "shiki";
import { useSettingsStore } from "@/stores/settings-store";
import { Skeleton } from "@/components/shared/LoadingSpinner";

interface CodeViewerProps {
  code: string;
  language: string;
  highlightLines?: number[];
  /** Highlight a contiguous range of lines (inclusive). Takes priority over highlightLines for range lines. */
  highlightRange?: [number, number];
  startLine?: number;
  maxHeight?: string;
  className?: string;
}

export function CodeViewer({
  code,
  language,
  highlightLines = [],
  highlightRange,
  startLine = 1,
  maxHeight = "500px",
  className = "",
}: CodeViewerProps) {
  const [html, setHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const { codeTheme } = useSettingsStore((s) => s.display);

  // Stabilise array/tuple references so effects don't re-fire on every render
  const stableHighlightLines = useMemo(
    () => highlightLines,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [highlightLines.join(",")],
  );
  const stableHighlightRange = useMemo(
    () => highlightRange,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [highlightRange?.[0], highlightRange?.[1]],
  );

  useEffect(() => {
    let cancelled = false;
    const highlightSet = new Set(stableHighlightLines);

    async function highlight() {
      // Only show loading skeleton on the very first render
      if (isFirstRender.current) {
        setIsLoading(true);
      }
      try {
        const result = await codeToHtml(code, {
          lang: mapLanguage(language),
          theme: codeTheme as "github-dark",
          transformers: [
            {
              line(node, line) {
                const lineNum = line + startLine - 1;
                if (stableHighlightRange && lineNum >= stableHighlightRange[0] && lineNum <= stableHighlightRange[1]) {
                  this.addClassToHast(node, "cv-active-line");
                } else if (highlightSet.has(lineNum)) {
                  this.addClassToHast(node, "cv-active-line");
                }
              },
            },
          ],
        });
        if (!cancelled) {
          setHtml(result);
          setIsLoading(false);
          isFirstRender.current = false;
        }
      } catch {
        if (!cancelled) {
          setHtml(`<pre><code>${escapeHtml(code)}</code></pre>`);
          setIsLoading(false);
          isFirstRender.current = false;
        }
      }
    }

    highlight();
    return () => {
      cancelled = true;
    };
  }, [code, language, codeTheme, stableHighlightLines, stableHighlightRange, startLine]);

  // Keep preview focused on the selected trace line.
  useEffect(() => {
    if (isLoading || !containerRef.current) return;
    const target = containerRef.current.querySelector(".cv-active-line") as HTMLElement | null;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isLoading, html]);

  if (isLoading) {
    return (
      <div className={`rounded-lg bg-bg-surface p-4 ${className}`}>
        <Skeleton lines={Math.min(code.split("\n").length, 10)} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto rounded-lg border border-border-default ${className}`}
      style={{ maxHeight }}
    >
      <style>{`
        .cv-active-line {
          background: rgba(59, 130, 246, 0.12) !important;
          border-left: 3px solid #3b82f6 !important;
        }
        .shiki {
          padding: 0.75rem 0.75rem 0.75rem 2.5rem;
          margin: 0;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 12.5px;
          line-height: 1.6;
          counter-reset: line-number ${Math.max(0, startLine - 1)};
        }
        .shiki code {
          counter-reset: line-number ${Math.max(0, startLine - 1)};
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
          user-select: none;
        }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: html }} />
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
