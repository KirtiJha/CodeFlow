import type { SimpleGit } from "simple-git";
import { createLogger } from "../utils/logger.js";

const log = createLogger("git:log");

export interface LogEntry {
  hash: string;
  abbreviatedHash: string;
  author: string;
  authorEmail: string;
  date: string;
  message: string;
  filesChanged: string[];
  insertions: number;
  deletions: number;
}

/**
 * Extracts structured log entries from git history.
 */
export class LogAnalyzer {
  constructor(private readonly git: SimpleGit) {}

  async getLog(file?: string, days?: number): Promise<LogEntry[]> {
    const args: string[] = [
      "log",
      "--format=%H|%h|%an|%ae|%aI|%s",
      "--numstat",
    ];

    if (days) {
      args.push(`--since=${days} days ago`);
    }

    if (file) {
      args.push("--", file);
    }

    let raw: string;
    try {
      raw = await this.git.raw(args);
    } catch (err) {
      log.warn({ file, days, err }, "Log failed");
      return [];
    }

    return this.parseLog(raw);
  }

  /**
   * Get change frequency stats for a file.
   */
  async getChangeFrequency(
    filePath: string,
    days: number = 90,
  ): Promise<{
    commitCount: number;
    uniqueAuthors: number;
    linesAdded: number;
    linesRemoved: number;
    recentCommits: number;
  }> {
    const entries = await this.getLog(filePath, days);
    const authors = new Set<string>();
    let linesAdded = 0;
    let linesRemoved = 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let recentCommits = 0;

    for (const entry of entries) {
      authors.add(entry.authorEmail);
      linesAdded += entry.insertions;
      linesRemoved += entry.deletions;
      if (new Date(entry.date) > thirtyDaysAgo) {
        recentCommits++;
      }
    }

    return {
      commitCount: entries.length,
      uniqueAuthors: authors.size,
      linesAdded,
      linesRemoved,
      recentCommits,
    };
  }

  private parseLog(raw: string): LogEntry[] {
    const entries: LogEntry[] = [];
    if (!raw.trim()) return entries;

    const lines = raw.split("\n");
    let current: LogEntry | null = null;

    for (const line of lines) {
      // Header line: hash|abbrevHash|author|email|date|message
      const parts = line.split("|");
      if (parts.length >= 6 && /^[0-9a-f]{40}$/.test(parts[0] ?? "")) {
        if (current) entries.push(current);
        current = {
          hash: parts[0] ?? "",
          abbreviatedHash: parts[1] ?? "",
          author: parts[2] ?? "",
          authorEmail: parts[3] ?? "",
          date: parts[4] ?? "",
          message: parts.slice(5).join("|"),
          filesChanged: [],
          insertions: 0,
          deletions: 0,
        };
        continue;
      }

      if (!current) continue;

      // Numstat line: insertions\tdeletions\tfilepath
      const numstatMatch = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (numstatMatch) {
        const ins =
          numstatMatch[1] === "-" ? 0 : parseInt(numstatMatch[1] ?? "0", 10);
        const del =
          numstatMatch[2] === "-" ? 0 : parseInt(numstatMatch[2] ?? "0", 10);
        current.insertions += ins;
        current.deletions += del;
        current.filesChanged.push(numstatMatch[3] ?? "");
      }
    }

    if (current) entries.push(current);
    return entries;
  }
}
