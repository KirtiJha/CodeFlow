export interface AnalysisResult {
  dbPath: string;
  repoPath: string;
  stats: AnalysisStats;
  completedAt: string;
}

export interface AnalysisStats {
  totalFiles: number;
  totalNodes: number;
  totalEdges: number;
  totalFunctions: number;
  totalClasses: number;
  totalCommunities: number;
  totalProcesses: number;
  totalTests: number;
  totalTaintFlows: number;
  parseErrors: number;
  durationMs: number;
  languageBreakdown: Record<string, number>;
  totalSymbols?: number;
  symbolChange?: number;
  languages?: string[];
  functions?: number;
  classes?: number;
  callEdges?: number;
  dataFlowEdges?: number;
  communities?: number;
  duration?: number;
  lastAnalyzed?: string;
}

export interface AnalysisJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  phase: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  result?: AnalysisResult;
}

export interface PipelineProgress {
  phase: string;
  phaseIndex: number;
  totalPhases: number;
  current: number;
  total: number;
  percent: number;
  message?: string;
}
