import { useEffect, useState, useRef } from "react";
import { codeToHtml } from "shiki";
import { useSettingsStore } from "@/stores/settings-store";
import { Skeleton } from "@/components/shared/LoadingSpinner";

interface CodeViewerProps {
  code: string;
  language: string;
  highlightLines?: number[];
  startLine?: number;
  maxHeight?: string;
  className?: string;
}

export function CodeViewer({
  code,
  language,
  highlightLines = [],
  startLine = 1,
  maxHeight = "500px",
  className = "",
}: CodeViewerProps) {
  const [html, setHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { showLineNumbers: _showLineNumbers, codeTheme } = useSettingsStore((s) => s.display);
  const highlightSet = new Set(highlightLines);

  useEffect(() => {
    let cancelled = false;

    async function highlight() {
      setIsLoading(true);
      try {
        const result = await codeToHtml(code, {
          lang: mapLanguage(language),
          theme: codeTheme as "github-dark",
          transformers: [
            {
              line(node, line) {
                const lineNum = line + startLine - 1;
                if (highlightSet.has(lineNum)) {
                  this.addClassToHast(node, "highlighted-line");
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
          setHtml(`<pre><code>${escapeHtml(code)}</code></pre>`);
          setIsLoading(false);
        }
      }
    }

    highlight();
    return () => {
      cancelled = true;
    };
  }, [code, language, codeTheme, highlightLines, startLine]);

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
        .highlighted-line {
          background: rgba(59, 130, 246, 0.1);
          border-left: 2px solid #3b82f6;
        }
        .shiki { padding: 1rem; margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.6; }
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
