import {
  simpleGit,
  type SimpleGit,
  type DefaultLogFields,
  type ListLogLine,
} from "simple-git";
import { DiffParser, type FileDiff } from "./diff-parser.js";
import { BlameAnalyzer, type BlameLine } from "./blame-analyzer.js";
import { LogAnalyzer, type LogEntry } from "./log-analyzer.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("git:client");

export interface BranchInfo {
  name: string;
  isRemote: boolean;
  isCurrent: boolean;
  commitHash: string;
  lastCommitDate?: string;
}

export interface MergeResult {
  canMerge: boolean;
  conflictingFiles: string[];
}

export class GitClient {
  private readonly git: SimpleGit;
  private readonly diffParser: DiffParser;
  private readonly blameAnalyzer: BlameAnalyzer;
  private readonly logAnalyzer: LogAnalyzer;

  constructor(repoPath: string) {
    this.git = simpleGit(repoPath);
    this.diffParser = new DiffParser();
    this.blameAnalyzer = new BlameAnalyzer(this.git);
    this.logAnalyzer = new LogAnalyzer(this.git);
  }

  /** Return the underlying SimpleGit instance for advanced usage. */
  raw(): SimpleGit {
    return this.git;
  }

  // ── Branch operations ─────────────────────────────────────

  async listBranches(): Promise<BranchInfo[]> {
    const summary = await this.git.branch(["-a", "--sort=-committerdate"]);
    const branches: BranchInfo[] = [];

    for (const [name, data] of Object.entries(summary.branches)) {
      branches.push({
        name: name.replace(/^remotes\/origin\//, ""),
        isRemote: name.startsWith("remotes/"),
        isCurrent: data.current,
        commitHash: data.commit,
      });
    }

    return branches;
  }

  async getCurrentBranch(): Promise<string> {
    const result = await this.git.revparse(["--abbrev-ref", "HEAD"]);
    return result.trim();
  }

  async getMainBranch(): Promise<string> {
    try {
      // Try to detect main/master from remote
      const remoteInfo = await this.git.remote(["show", "origin"]);
      if (typeof remoteInfo === "string") {
        const match = remoteInfo.match(/HEAD branch:\s+(\S+)/);
        if (match) return match[1] ?? "";
      }
    } catch {
      // Fallback: check if main or master exists
    }

    const branches = await this.git.branchLocal();
    if (branches.all.includes("main")) return "main";
    if (branches.all.includes("master")) return "master";
    return branches.current || "main";
  }

  // ── Diff operations ───────────────────────────────────────

  async diffBranch(branch: string, base?: string): Promise<FileDiff[]> {
    const baseBranch = base ?? (await this.getMainBranch());
    const mergeBase = await this.git.raw(["merge-base", baseBranch, branch]);
    const raw = await this.git.diff([mergeBase.trim(), branch]);
    return this.diffParser.parse(raw);
  }

  async diffRange(from: string, to: string): Promise<FileDiff[]> {
    const raw = await this.git.diff([from, to]);
    return this.diffParser.parse(raw);
  }

  async diffWorktree(): Promise<FileDiff[]> {
    const raw = await this.git.diff();
    return this.diffParser.parse(raw);
  }

  // ── History operations ────────────────────────────────────

  async log(file?: string, days?: number): Promise<LogEntry[]> {
    return this.logAnalyzer.getLog(file, days);
  }

  async blame(file: string): Promise<BlameLine[]> {
    return this.blameAnalyzer.analyze(file);
  }

  // ── Content operations ────────────────────────────────────

  async showFile(path: string, ref: string): Promise<string> {
    return this.git.show([`${ref}:${path}`]);
  }

  // ── Merge simulation ─────────────────────────────────────

  async canMerge(branchA: string, branchB: string): Promise<MergeResult> {
    try {
      await this.git.raw(["merge-tree", "--write-tree", branchA, branchB]);
      return { canMerge: true, conflictingFiles: [] };
    } catch (err: unknown) {
      const output = err instanceof Error ? err.message : String(err);
      const conflicting: string[] = [];
      const re = /CONFLICT \(content\): Merge conflict in (.+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(output)) !== null) {
        conflicting.push(m[1] ?? "");
      }
      return {
        canMerge: conflicting.length === 0,
        conflictingFiles: conflicting,
      };
    }
  }
}
