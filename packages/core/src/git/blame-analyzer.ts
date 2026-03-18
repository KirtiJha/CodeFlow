import type { SimpleGit } from "simple-git";
import { createLogger } from "../utils/logger.js";

const log = createLogger("git:blame");

export interface BlameLine {
  lineNo: number;
  commitHash: string;
  author: string;
  authorEmail: string;
  date: string;
  content: string;
}

/**
 * Parses `git blame --porcelain` output for per-line attribution.
 */
export class BlameAnalyzer {
  constructor(private readonly git: SimpleGit) {}

  async analyze(filePath: string): Promise<BlameLine[]> {
    let raw: string;
    try {
      raw = await this.git.raw(["blame", "--porcelain", filePath]);
    } catch (err) {
      log.warn({ filePath, err }, "Blame failed");
      return [];
    }

    return this.parsePorcelain(raw);
  }

  private parsePorcelain(raw: string): BlameLine[] {
    const lines = raw.split("\n");
    const result: BlameLine[] = [];

    let currentHash = "";
    let author = "";
    let authorEmail = "";
    let date = "";
    let lineNo = 0;

    for (const line of lines) {
      // Commit line: <hash> <origLineNo> <finalLineNo> [<numLines>]
      const commitMatch = line.match(/^([0-9a-f]{40})\s+\d+\s+(\d+)/);
      if (commitMatch) {
        currentHash = commitMatch[1] ?? "";
        lineNo = parseInt(commitMatch[2] ?? "0", 10);
        continue;
      }

      if (line.startsWith("author ")) {
        author = line.slice(7);
      } else if (line.startsWith("author-mail ")) {
        authorEmail = line.slice(12).replace(/[<>]/g, "");
      } else if (line.startsWith("author-time ")) {
        const timestamp = parseInt(line.slice(12), 10);
        date = new Date(timestamp * 1000).toISOString();
      } else if (line.startsWith("\t")) {
        // Content line (prefixed with tab)
        result.push({
          lineNo,
          commitHash: currentHash,
          author,
          authorEmail,
          date,
          content: line.slice(1),
        });
      }
    }

    return result;
  }
}
