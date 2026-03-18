// ─── Taint / Security Flow Types ──────────────────────────────

export type TaintSeverity = "critical" | "warning" | "info";

export type TaintCategory =
  | "sql_injection"
  | "xss"
  | "command_injection"
  | "path_traversal"
  | "pii_leak"
  | "ssrf"
  | "open_redirect"
  | "log_injection"
  | "prototype_pollution"
  | "insecure_deserialization";

export interface TaintFlow {
  id: string;
  repoId: string;
  severity: TaintSeverity;
  category: TaintCategory;
  sourceDfgNodeId: string;
  sinkDfgNodeId: string;
  path: TaintPathStep[];
  isSanitized: boolean;
  sanitizerLocation?: string;
  fixSuggestion?: string;
}

export interface TaintPathStep {
  dfgNodeId: string;
  code: string;
  filePath: string;
  line: number;
  transform?: string;
  isSanitizer: boolean;
}

export interface SourcePattern {
  kind: string;
  pattern: RegExp;
  category: TaintCategory;
  description: string;
}

export interface SinkPattern {
  kind: string;
  pattern: RegExp;
  category: TaintCategory;
  severity: TaintSeverity;
  description: string;
}

export interface SanitizerPattern {
  kind: string;
  pattern: RegExp;
  sanitizes: TaintCategory[];
  description: string;
}

export interface SecurityScanResult {
  flows: TaintFlow[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    totalSources: number;
    totalSinks: number;
    sanitizedCount: number;
  };
}
