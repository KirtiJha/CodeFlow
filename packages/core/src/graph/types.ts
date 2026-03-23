// ─── Node Types ───────────────────────────────────────────────

export type NodeKind =
  | "project"
  | "package"
  | "module"
  | "folder"
  | "file"
  | "class"
  | "function"
  | "method"
  | "constructor"
  | "interface"
  | "enum"
  | "struct"
  | "trait"
  | "impl"
  | "property"
  | "type_alias"
  | "const"
  | "static"
  | "decorator"
  | "annotation"
  | "namespace"
  | "union"
  | "community"
  | "process";

export type EdgeKind =
  | "contains"
  | "calls"
  | "imports"
  | "extends"
  | "implements"
  | "overrides"
  | "has_method"
  | "member_of"
  | "step_in_process"
  | "defines"
  | "data_flow"
  | "test_covers";

// ─── Source Location ──────────────────────────────────────────

export interface SourceLocation {
  filePath: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

// ─── Graph Node ───────────────────────────────────────────────

export interface GraphNode {
  id: string;
  kind: NodeKind;
  name: string;
  qualifiedName?: string;
  filePath: string;
  startLine?: number;
  endLine?: number;
  language?: Language;
  signature?: string;
  paramCount?: number;
  returnType?: string;
  ownerId?: string;
  communityId?: string;
  complexityCyclomatic?: number;
  complexityCognitive?: number;
  riskScore?: number;
  isTest?: boolean;
  isEntryPoint?: boolean;
  metadata?: Record<string, unknown>;
  repoId?: string;
  location?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

// ─── Graph Edge ───────────────────────────────────────────────

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  kind: EdgeKind;
  confidence?: number;
  metadata?: Record<string, unknown>;
  repoId?: string;
}

// ─── Language ─────────────────────────────────────────────────

export type Language =
  | "typescript"
  | "javascript"
  | "python"
  | "java"
  | "go"
  | "rust"
  | "csharp"
  | "kotlin"
  | "php"
  | "ruby"
  | "swift"
  | "c"
  | "cpp";

// ─── Knowledge Graph Interface ────────────────────────────────

export interface KnowledgeGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;

  addNode(node: GraphNode): void;
  addEdge(edge: GraphEdge): void;
  getNode(id: string): GraphNode | undefined;
  getEdge(id: string): GraphEdge | undefined;
  removeNode(id: string): void;
  removeEdge(id: string): void;

  getOutgoingEdges(nodeId: string, kind?: EdgeKind): GraphEdge[];
  getIncomingEdges(nodeId: string, kind?: EdgeKind): GraphEdge[];
  getNeighbors(nodeId: string, kind?: EdgeKind): GraphNode[];

  getNodesByKind(kind: NodeKind): GraphNode[];
  getNodesByFile(filePath: string): GraphNode[];
  getEdgesByKind(kind: EdgeKind): GraphEdge[];

  readonly nodeCount: number;
  readonly edgeCount: number;
}

// ─── Extracted Data (from parsing) ────────────────────────────

export interface ExtractedSymbol {
  name: string;
  kind: NodeKind;
  filePath: string;
  startLine?: number;
  endLine?: number;
  startColumn?: number;
  endColumn?: number;
  language?: Language;
  location?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  owner?: string;
  signature?: string;
  paramCount?: number;
  returnType?: string;
  parentName?: string;
  decorators?: string[];
  isExported?: boolean;
  isAsync?: boolean;
  isStatic?: boolean;
  typeAnnotation?: string;
}

export interface ExtractedImport {
  filePath?: string;
  modulePath?: string;
  source?: string;
  names?: Array<{ name: string; alias?: string }>;
  specifiers?: Array<{ name: string; alias?: string }>;
  isDefault?: boolean;
  isNamespace?: boolean;
  namespaceName?: string;
  language?: Language;
  line?: number;
  location?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  isTypeOnly?: boolean;
}

export interface ExtractedCall {
  filePath: string;
  callerName?: string;
  calleeName?: string;
  callee?: string;
  receiverName?: string;
  receiver?: string;
  line?: number;
  column?: number;
  argCount?: number;
  isConstructor?: boolean;
  isMethodCall?: boolean;
  language?: Language;
  location?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export interface ExtractedHeritage {
  filePath: string;
  childName: string;
  parentName: string;
  kind: "extends" | "implements";
  language?: Language;
  line?: number;
  location?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export interface ParseResult {
  filePath: string;
  language: Language;
  symbols: ExtractedSymbol[];
  imports: ExtractedImport[];
  calls: ExtractedCall[];
  heritage: ExtractedHeritage[];
}

// ─── Pipeline Types ───────────────────────────────────────────

export type PipelinePhase =
  | "parsing"
  | "symbols"
  | "cfg"
  | "dfg"
  | "callgraph"
  | "summaries"
  | "communities"
  | "processes"
  | "tests"
  | "schema"
  | "taint"
  | "metrics";

export interface PipelineConfig {
  repoPath: string;
  languages?: Language[];
  branch?: string;
  maxFileSize?: number;
  byteBudget?: number;
  workerCount?: number;
  excludePatterns?: string[];
  enableCfg?: boolean;
  enableDfg?: boolean;
  enableTaint?: boolean;
  enableBranches?: boolean;
  onProgress?: (phase: PipelinePhase, pct: number, message: string) => void;
}

export interface PipelineResult {
  stats: PipelineStats;
  dbPath: string;
  repoId: string;
}

export interface PipelineStats {
  files: number;
  symbols: number;
  functions: number;
  edges: number;
  communities: number;
  processes: number;
  dataFlows: number;
  testMappings: number;
  schemaModels: number;
  taintFlows: number;
  durationMs: number;
  languages: string[];
}
