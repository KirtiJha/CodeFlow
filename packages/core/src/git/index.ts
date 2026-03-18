export { GitClient, type BranchInfo, type MergeResult } from "./git-client.js";
export {
  DiffParser,
  type FileDiff,
  type DiffHunk,
  type DiffLine,
} from "./diff-parser.js";
export { BlameAnalyzer, type BlameLine } from "./blame-analyzer.js";
export { LogAnalyzer, type LogEntry } from "./log-analyzer.js";
