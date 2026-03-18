export interface BranchInfo {
  name: string;
  current: boolean;
  lastCommit: string;
  lastCommitDate: string;
  author: string;
  ahead: number;
  behind: number;
}

export interface BranchConflict {
  branch1: string;
  branch2: string;
  level: ConflictLevel;
  severity: ConflictSeverity;
  details: ConflictDetail[];
  detectedAt: string;
}

export type ConflictLevel =
  | "file"
  | "symbol"
  | "signature"
  | "semantic"
  | "schema";

export type ConflictSeverity = "low" | "medium" | "high" | "critical";

export interface ConflictDetail {
  type: ConflictLevel;
  file: string;
  symbol?: string;
  description: string;
  line?: number;
  suggestion?: string;
}

export interface BranchMatrix {
  branches: string[];
  conflicts: Array<{
    row: number;
    col: number;
    severity: ConflictSeverity;
    count: number;
  }>;
}

export interface BranchDiff {
  branch: string;
  base: string;
  files: FileDiff[];
  stats: { added: number; modified: number; deleted: number };
}

export interface FileDiff {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  linesAdded: number;
  linesRemoved: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "context" | "add" | "remove";
  content: string;
  oldLine?: number;
  newLine?: number;
}
