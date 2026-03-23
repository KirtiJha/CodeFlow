export interface ApiResponse<T> {
  data: T;
  status: "ok" | "error";
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AnalyzeRequest {
  repoPath: string;
  languages?: string[];
  excludePatterns?: string[];
}

export interface TraceRequest {
  file: string;
  symbol?: string;
  line?: number;
  depth?: number;
  direction?: "forward" | "backward" | "both";
}

export interface SearchRequest {
  query: string;
  mode?: "hybrid" | "keyword" | "semantic";
  limit?: number;
  fileFilter?: string;
}

export interface SearchResult {
  id: string;
  name: string;
  kind: string;
  file: string;
  line: number;
  score: number;
  snippet?: string;
}

export interface RiskScoreResponse {
  target: string;
  score: number;
  level: "low" | "medium" | "high" | "critical";
  factors: RiskFactor[];
  recommendation: string;
  stats?: {
    totalFunctions: number;
    byLevel: Record<string, number>;
  };
  fileRisks?: FileRisk[];
}

export interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
}

export interface FileRisk {
  file: string;
  avgScore: number;
  maxScore: number;
  functionCount: number;
  level: "low" | "medium" | "high" | "critical";
}

export interface RiskHotspot {
  name: string;
  file: string;
  line?: number;
  score: number;
  level: "low" | "medium" | "high" | "critical";
  factors: RiskFactor[];
  recommendation: string;
}

export interface SchemaModel {
  name: string;
  file: string;
  fields: SchemaField[];
  references: SchemaReference[];
}

export interface SchemaField {
  name: string;
  type: string;
  line: number;
  referenceCount: number;
  references?: SchemaReference[];
  nullable?: boolean;
  primaryKey?: boolean;
  indexed?: boolean;
}

export interface SchemaReference {
  file: string;
  line: number;
  kind: string;
  symbol: string;
  from?: string;
  to?: string;
  field?: string;
  type?: string;
}

export interface TestImpactResult {
  changedFiles: string[];
  tests: TestInfo[];
  testsToRun: TestInfo[];
  testsSkipped: TestInfo[];
  testGaps: TestGap[];
  coverage: CoverageInfo;
}

export interface CoverageInfo {
  covered: number;
  total: number;
  byFile: Array<{ file: string; covered: number; total: number }>;
}

export interface TestInfo {
  id: string;
  name: string;
  file: string;
  line: number;
  framework: string;
  reason: string;
  status?: string;
  type?: string;
  codeSnippet?: string;
}

export interface TestGap {
  file: string;
  function: string;
  symbol: string;
  line: number;
  complexity: number;
  risk: string;
  reason?: string;
  suggestions?: string[];
}

export interface StatusResponse {
  repoPath: string;
  dbPath: string;
  analyzedAt: string;
  stats: {
    nodes: number;
    edges: number;
    files: number;
    functions: number;
    classes: number;
    communities: number;
  };
}
