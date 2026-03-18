// ─── Branch Conflict Types ────────────────────────────────────

export type ConflictLevel = 1 | 2 | 3 | 4 | 5;

export type ConflictSeverity = "low" | "medium" | "high" | "critical";

export interface BranchSnapshot {
  id: string;
  repoId: string;
  branchName: string;
  author: string;
  lastCommitHash: string;
  lastCommitDate: string;
  commitCount: number;
  filesChanged: string[];
  fingerprint: BranchFingerprint | null;
  scannedAt: string;
}

export interface BranchFingerprint {
  filesChanged: Set<string>;
  symbolsAdded: Set<string>;
  symbolsRemoved: Set<string>;
  symbolsModified: Map<string, SymbolDiff>;
  signaturesChanged: Map<string, SignatureDiff>;
  summariesChanged: Map<string, SummaryDiff>;
  schemasChanged: Map<string, FieldDiff>;
}

export interface SymbolDiff {
  qualifiedName: string;
  kind: "added" | "removed" | "modified";
  beforeLines?: [number, number];
  afterLines?: [number, number];
  linesAdded: number;
  linesRemoved: number;
}

export interface SignatureDiff {
  qualifiedName: string;
  beforeParams: ParamInfo[];
  afterParams: ParamInfo[];
  beforeReturnType?: string;
  afterReturnType?: string;
}

export interface ParamInfo {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: string;
}

export interface SummaryDiff {
  qualifiedName: string;
  beforeCanReturnNull: boolean;
  afterCanReturnNull: boolean;
  addedSideEffects: string[];
  removedSideEffects: string[];
  changedParamFlows: string[];
}

export interface FieldDiff {
  model: string;
  field: string;
  kind: "added" | "removed" | "renamed" | "type_changed";
  beforeType?: string;
  afterType?: string;
  newName?: string;
}

export interface BranchConflict {
  id: string;
  repoId: string;
  branchA: string;
  branchB: string;
  level: ConflictLevel;
  severity: ConflictSeverity;
  details: ConflictDetail;
  detectedAt: string;
}

export type ConflictDetail =
  | FileOverlapDetail
  | SymbolOverlapDetail
  | SignatureConflictDetail
  | SemanticConflictDetail
  | SchemaConflictDetail;

export interface FileOverlapDetail {
  level: 1;
  files: string[];
}

export interface SymbolOverlapDetail {
  level: 2;
  symbols: Array<{
    qualifiedName: string;
    file: string;
    branchAChange: string;
    branchBChange: string;
  }>;
}

export interface SignatureConflictDetail {
  level: 3;
  conflicts: Array<{
    qualifiedName: string;
    changeBranch: string;
    dependentBranch: string;
    oldSignature: string;
    newSignature: string;
    callers: string[];
  }>;
}

export interface SemanticConflictDetail {
  level: 4;
  conflicts: Array<{
    qualifiedName: string;
    changeBranch: string;
    dependentBranch: string;
    behaviorChange: string;
    dependentCode: string;
  }>;
}

export interface SchemaConflictDetail {
  level: 5;
  conflicts: Array<{
    model: string;
    field: string;
    changeBranch: string;
    dependentBranch: string;
    changeKind: string;
    dependentUsage: string;
  }>;
}

export interface MergeSimulationResult {
  hasTextualConflicts: boolean;
  conflictingFiles: FileConflict[];
}

export interface FileConflict {
  filePath: string;
  conflictMarkers: ConflictMarker[];
}

export interface ConflictMarker {
  startLine: number;
  endLine: number;
  oursContent: string;
  theirsContent: string;
}
