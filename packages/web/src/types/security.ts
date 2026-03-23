export interface TaintFlow {
  id: string;
  severity: TaintSeverity;
  category: string;
  source: TaintLocation;
  sink: TaintLocation;
  path: TaintLocation[];
  fix: string;
  description?: string;
}

export type TaintSeverity = "low" | "medium" | "high" | "critical";

export interface TaintLocation {
  file: string;
  line: number;
  column: number;
  name: string;
  kind: string;
  symbol?: string;
}

export interface SecurityReport {
  totalFlows: number;
  bySeverity: Record<TaintSeverity, number>;
  byCategory: Record<string, number>;
  flows: TaintFlow[];
  scannedAt: string;
  scanners?: string[];
}

export interface SecurityScore {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  overall: number;
  taintScore: number;
  inputValidation: number;
  dependencySafety: number;
  dataFlowScore: number;
  totalFlows: number;
  resolvedCount: number;
}
