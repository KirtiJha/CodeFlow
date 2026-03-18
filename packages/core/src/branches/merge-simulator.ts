import type { SimpleGit } from "simple-git";
import type {
  MergeSimulationResult,
  FileConflict,
  ConflictMarker,
} from "./conflict-types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("branches:merge-simulator");

/**
 * Simulates a git merge between two branches to detect textual conflicts
 * without actually modifying the working tree.
 */
export class MergeSimulator {
  constructor(private readonly git: SimpleGit) {}

  /**
   * Simulate a merge of branchB into branchA.
   */
  async simulate(
    branchA: string,
    branchB: string,
  ): Promise<MergeSimulationResult> {
    try {
      // Use git merge-tree to simulate merge without touching worktree
      const result = await this.git.raw([
        "merge-tree",
        "--write-tree",
        "--no-messages",
        `origin/${branchA}`,
        `origin/${branchB}`,
      ]);

      // If merge-tree succeeds with exit code 0, no conflicts
      return {
        hasTextualConflicts: false,
        conflictingFiles: [],
      };
    } catch (err: unknown) {
      // merge-tree exits with code 1 when conflicts exist
      const errorOutput = err instanceof Error ? err.message : String(err);

      // Try to parse conflict info from output
      const conflictingFiles = this.parseConflicts(errorOutput);

      return {
        hasTextualConflicts: conflictingFiles.length > 0,
        conflictingFiles,
      };
    }
  }

  /**
   * Parse conflict information from git merge-tree output.
   */
  private parseConflicts(output: string): FileConflict[] {
    const conflicts: FileConflict[] = [];
    const lines = output.split("\n");

    let currentFile: string | null = null;
    let currentMarkers: ConflictMarker[] = [];
    let inConflict = false;
    let oursLines: string[] = [];
    let theirsLines: string[] = [];
    let conflictStart = 0;
    let lineNum = 0;

    for (const line of lines) {
      lineNum++;

      // Detect file paths in conflict output
      const fileMatch = line.match(
        /^CONFLICT \(content\): Merge conflict in (.+)$/,
      );
      if (fileMatch) {
        if (currentFile && currentMarkers.length > 0) {
          conflicts.push({
            filePath: currentFile,
            conflictMarkers: currentMarkers,
          });
        }
        currentFile = fileMatch[1] ?? "";
        currentMarkers = [];
        continue;
      }

      // Parse conflict markers
      if (line.startsWith("<<<<<<<")) {
        inConflict = true;
        conflictStart = lineNum;
        oursLines = [];
        theirsLines = [];
      } else if (line.startsWith("=======") && inConflict) {
        // Switch from ours to theirs
      } else if (line.startsWith(">>>>>>>") && inConflict) {
        inConflict = false;
        currentMarkers.push({
          startLine: conflictStart,
          endLine: lineNum,
          oursContent: oursLines.join("\n"),
          theirsContent: theirsLines.join("\n"),
        });
      } else if (inConflict) {
        // Accumulate content
        if (oursLines.length === 0 || line.startsWith("=======")) {
          theirsLines.push(line);
        } else {
          oursLines.push(line);
        }
      }
    }

    // Push last file
    if (currentFile && currentMarkers.length > 0) {
      conflicts.push({
        filePath: currentFile,
        conflictMarkers: currentMarkers,
      });
    }

    return conflicts;
  }
}
