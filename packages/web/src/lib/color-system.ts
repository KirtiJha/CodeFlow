const NODE_COLORS: Record<string, string> = {
  file: "#6366f1",
  class: "#8b5cf6",
  interface: "#a78bfa",
  enum: "#c4b5fd",
  function: "#3b82f6",
  method: "#60a5fa",
  arrow_function: "#93c5fd",
  variable: "#06b6d4",
  constant: "#22d3ee",
  property: "#67e8f9",
  parameter: "#a5f3fc",
  type_alias: "#ec4899",
  import: "#f472b6",
  export: "#f9a8d4",
  module: "#f59e0b",
  namespace: "#fbbf24",
  constructor: "#10b981",
  getter: "#34d399",
  setter: "#6ee7b7",
  decorator: "#f97316",
  test: "#84cc16",
  schema: "#e879f9",
  route: "#fb923c",
  unknown: "#6b7280",
};

const EDGE_COLORS: Record<string, string> = {
  calls: "#3b82f6",
  imports: "#8b5cf6",
  extends: "#ec4899",
  implements: "#f472b6",
  uses: "#06b6d4",
  defines: "#10b981",
  contains: "#6366f1",
  overrides: "#f59e0b",
  data_flow: "#22d3ee",
  test_covers: "#84cc16",
  taint: "#ef4444",
  unknown: "#4b5563",
};

const SEVERITY_COLORS = {
  low: { bg: "#052e16", text: "#10b981", border: "#065f46" },
  medium: { bg: "#422006", text: "#f59e0b", border: "#713f12" },
  high: { bg: "#431407", text: "#f97316", border: "#7c2d12" },
  critical: { bg: "#450a0a", text: "#ef4444", border: "#7f1d1d" },
} as const;

const LANGUAGE_COLORS: Record<string, string> = {
  typescript: "#3178c6",
  javascript: "#f7df1e",
  python: "#3572a5",
  java: "#b07219",
  go: "#00add8",
  rust: "#dea584",
  ruby: "#cc342d",
  csharp: "#68217a",
  cpp: "#f34b7d",
  c: "#555555",
  swift: "#f05138",
  kotlin: "#a97bff",
  php: "#4f5d95",
};

export function getNodeColor(kind: string): string {
  return NODE_COLORS[kind] ?? NODE_COLORS.unknown;
}

export function getEdgeColor(kind: string): string {
  return EDGE_COLORS[kind] ?? EDGE_COLORS.unknown;
}

export function getSeverityColor(severity: string): {
  bg: string;
  text: string;
  border: string;
} {
  return (
    SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] ??
    SEVERITY_COLORS.low
  );
}

export function getLanguageColor(language: string): string {
  return LANGUAGE_COLORS[language.toLowerCase()] ?? "#6b7280";
}

export function getRiskColor(score: number): string {
  if (score >= 0.8) return "#ef4444";
  if (score >= 0.6) return "#f97316";
  if (score >= 0.4) return "#f59e0b";
  if (score >= 0.2) return "#10b981";
  return "#06b6d4";
}

export function getCommunityColor(index: number): string {
  const palette = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#ec4899",
    "#f97316",
    "#84cc16",
    "#6366f1",
    "#14b8a6",
    "#e879f9",
    "#fb923c",
    "#22d3ee",
    "#a3e635",
  ];
  return palette[index % palette.length];
}
