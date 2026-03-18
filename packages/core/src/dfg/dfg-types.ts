// ─── Data Flow Graph Types ────────────────────────────────────

import type { SourceLocation } from "../graph/types.js";

export interface DFGNode {
  id: string;
  functionId: string;
  kind: DFGNodeKind;
  code: string;
  location?: SourceLocation;
  dataType?: string;
  isSource?: boolean;
  isSink?: boolean;
  isSanitizer?: boolean;
  sourceKind?: SourceKind;
  sinkKind?: SinkKind;
  repoId?: string;
  filePath?: string;
  line?: number;
  column?: number;
}

export type DFGNodeKind =
  | "param"
  | "assignment"
  | "call_result"
  | "field_read"
  | "field_write"
  | "return"
  | "literal"
  | "binary_op"
  | "source"
  | "sink"
  | "phi"
  | "destructure"
  | "spread"
  | "await"
  | "yield";

export type SourceKind =
  | "http_input"
  | "env_var"
  | "db_read"
  | "file_read"
  | "user_input"
  | "api_response"
  | "config"
  | "unknown";

export type SinkKind =
  | "database"
  | "sql_execution"
  | "http_response"
  | "log"
  | "file_write"
  | "exec"
  | "eval"
  | "external_api"
  | "html_render"
  | "url_redirect"
  | "unknown";

export interface DFGEdge {
  id: string;
  sourceId: string;
  targetId: string;
  kind: DFGEdgeKind;
  transform?: string;
  isSanitizing?: boolean;
  repoId?: string;
}

export type DFGEdgeKind =
  | "data_dep"
  | "param_bind"
  | "return_flow"
  | "field_flow"
  | "alias"
  | "transform"
  | "spread"
  | "destructure";

export interface DataFlowGraph {
  functionId: string;
  nodes: Map<string, DFGNode>;
  edges: DFGEdge[];

  sources: string[]; // DFGNode IDs
  sinks: string[]; // DFGNode IDs
  params: string[]; // DFGNode IDs
  returns: string[]; // DFGNode IDs
}

// ─── SSA Types ────────────────────────────────────────────────

export interface SSAVariable {
  name?: string;
  version: number;
  dfgNodeId?: string;
  blockId?: string;
  originalName?: string;
  definedAt?: string;
  usedAt?: string[];
}

export interface PhiNode {
  variable: string;
  blockId?: string;
  incoming?: Array<{ blockId: string; version: number }>;
  incomingVersions?: Array<{ blockId: string; version: number }>;
  resultVersion?: number;
  dfgNodeId?: string;
  id?: string;
}

// ─── Reaching Definitions ─────────────────────────────────────

export interface ReachingDef {
  variable: string;
  dfgNodeId?: string;
  blockId?: string;
  line?: number;
  definedAt?: string;
  reachesTo?: string[];
}
