import type { SimpleGit } from "simple-git";
import { createLogger } from "../utils/logger.js";

const log = createLogger("metrics:churn");

export interface ChurnResult {
  filePath: string;
  commitCount: number;
  uniqueAuthors: number;
  linesAdded: number;
  linesRemoved: number;
  lastModified: string;
  recentCommits: number; // commits in last 30 days
}

/**
 * Computes change frequency (churn) metrics from git history.
 */
export class ChurnCalculator {
  constructor(private readonly git: SimpleGit) {}

  /**
   * Compute churn for a single file.
   */
  async computeForFile(filePath: string, days = 90): Promise<ChurnResult> {
    const since = this.daysAgo(days);
    const recentSince = this.daysAgo(30);

    try {
      const logResult = await this.git.log({
        file: filePath,
        "--since": since,
        "--numstat": null,
      });

      const authors = new Set<string>();
      let linesAdded = 0;
      let linesRemoved = 0;
      let recentCount = 0;

      for (const commit of logResult.all) {
        authors.add(commit.author_email);

        const commitDate = new Date(commit.date);
        if (commitDate >= new Date(recentSince)) {
          recentCount++;
        }

        // Parse numstat from diff
        if (commit.diff) {
          for (const file of commit.diff.files) {
            if ("insertions" in file) {
              linesAdded += file.insertions;
            }
            if ("deletions" in file) {
              linesRemoved += file.deletions;
            }
          }
        }
      }

      return {
        filePath,
        commitCount: logResult.total,
        uniqueAuthors: authors.size,
        linesAdded,
        linesRemoved,
        lastModified: logResult.latest?.date ?? "",
        recentCommits: recentCount,
      };
    } catch {
      return {
        filePath,
        commitCount: 0,
        uniqueAuthors: 0,
        linesAdded: 0,
        linesRemoved: 0,
        lastModified: "",
        recentCommits: 0,
      };
    }
  }

  /**
   * Compute churn for all tracked files.
   */
  async computeAll(
    filePaths: string[],
    days = 90,
  ): Promise<Map<string, ChurnResult>> {
    const results = new Map<string, ChurnResult>();

    // Process in batches to avoid overwhelming git
    const BATCH_SIZE = 20;
    for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
      const batch = filePaths.slice(i, i + BATCH_SIZE);
      const promises = batch.map((f) => this.computeForFile(f, days));
      const batchResults = await Promise.all(promises);

      for (const result of batchResults) {
        results.set(result.filePath, result);
      }
    }

    log.debug({ files: results.size }, "Churn computed");
    return results;
  }

  private daysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  }
}
