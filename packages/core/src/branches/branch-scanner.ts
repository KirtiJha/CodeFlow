import type { SimpleGit, BranchSummary } from "simple-git";
import type { BranchSnapshot } from "./conflict-types.js";
import { v4 as uuid } from "uuid";
import { createLogger } from "../utils/logger.js";

const log = createLogger("branches:scanner");

export interface ScanOptions {
  maxAgeDays: number;
  excludePatterns: string[];
  baseBranch: string;
}

const DEFAULT_OPTIONS: ScanOptions = {
  maxAgeDays: 30,
  excludePatterns: ["HEAD", "main", "master", "develop", "release/"],
  baseBranch: "main",
};

/**
 * Scans git repository for active branches and creates snapshots.
 */
export class BranchScanner {
  constructor(
    private readonly git: SimpleGit,
    private readonly repoId: string,
  ) {}

  /**
   * List and snapshot all active branches.
   */
  async scan(options: Partial<ScanOptions> = {}): Promise<BranchSnapshot[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const snapshots: BranchSnapshot[] = [];

    // Get all remote branches
    const branches = await this.git.branch(["-r"]);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - opts.maxAgeDays);

    for (const branchName of branches.all) {
      // Filter out excluded patterns
      const cleanName = branchName.replace(/^origin\//, "");
      if (this.isExcluded(cleanName, opts.excludePatterns)) continue;

      try {
        const snapshot = await this.snapshotBranch(
          cleanName,
          opts.baseBranch,
          cutoffDate,
        );
        if (snapshot) {
          snapshots.push(snapshot);
        }
      } catch (err) {
        log.warn({ branch: cleanName, err }, "Failed to snapshot branch");
      }
    }

    log.info({ branches: snapshots.length }, "Branch scan complete");
    return snapshots;
  }

  /**
   * Create a snapshot for a single branch.
   */
  async snapshotBranch(
    branchName: string,
    baseBranch: string,
    cutoffDate: Date,
  ): Promise<BranchSnapshot | null> {
    // Get last commit info
    const logResult = await this.git.log({
      [`origin/${branchName}`]: null,
      maxCount: 1,
    });

    if (!logResult.latest) return null;

    // Check if branch is still active
    const lastCommitDate = new Date(logResult.latest.date);
    if (lastCommitDate < cutoffDate) return null;

    // Get changed files vs base
    let filesChanged: string[] = [];
    try {
      const diff = await this.git.diff([
        "--name-only",
        `origin/${baseBranch}...origin/${branchName}`,
      ]);
      filesChanged = diff
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);
    } catch {
      // Branch may not have common ancestor with base
      log.debug({ branch: branchName }, "Could not diff against base");
    }

    // Get commit count on branch
    let commitCount = 0;
    try {
      const countResult = await this.git.raw([
        "rev-list",
        "--count",
        `origin/${baseBranch}..origin/${branchName}`,
      ]);
      commitCount = parseInt(countResult.trim(), 10) || 0;
    } catch {
      commitCount = 0;
    }

    return {
      id: uuid(),
      repoId: this.repoId,
      branchName,
      author: logResult.latest.author_email,
      lastCommitHash: logResult.latest.hash,
      lastCommitDate: logResult.latest.date,
      commitCount,
      filesChanged,
      fingerprint: null, // Built separately by DiffAnalyzer
      scannedAt: new Date().toISOString(),
    };
  }

  private isExcluded(branchName: string, patterns: string[]): boolean {
    return patterns.some((p) => {
      if (p.endsWith("/")) return branchName.startsWith(p);
      return branchName === p;
    });
  }
}
