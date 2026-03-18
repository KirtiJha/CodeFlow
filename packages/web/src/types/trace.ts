export interface TraceResult {
  nodes: TraceNode[];
  edges: TraceEdge[];
  depth: number;
  direction: "forward" | "backward" | "both";
}

export interface TraceNode {
  id: string;
  name: string;
  kind: string;
  file: string;
  line: number;
  column: number;
  depth: number;
  language: string;
  community?: string;
  codeSnippet?: string;
}

export interface TraceEdge {
  id: string;
  source: string;
  target: string;
  kind: string;
  label?: string;
  weight: number;
}

export interface TraceQuery {
  file: string;
  symbol?: string;
  line?: number;
  depth: number;
  direction: "forward" | "backward" | "both";
  includeTests: boolean;
}
