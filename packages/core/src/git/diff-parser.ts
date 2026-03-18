/**
 * Parses unified diff output into structured FileDiff objects.
 */

export interface FileDiff {
  filePath: string;
  oldPath: string | null;
  status: "added" | "modified" | "deleted" | "renamed";
  hunks: DiffHunk[];
  linesAdded: number;
  linesRemoved: number;
  isBinary: boolean;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  oldLineNo: number | null;
  newLineNo: number | null;
}

export class DiffParser {
  parse(raw: string): FileDiff[] {
    const diffs: FileDiff[] = [];
    if (!raw.trim()) return diffs;

    // Split on diff headers
    const fileSections = raw.split(/^diff --git /m).filter(Boolean);

    for (const section of fileSections) {
      const diff = this.parseFileSection(section);
      if (diff) diffs.push(diff);
    }

    return diffs;
  }

  private parseFileSection(section: string): FileDiff | null {
    const lines = section.split("\n");
    if (lines.length === 0) return null;

    // Parse file paths from header: a/path b/path
    const headerMatch = lines[0]?.match(/^a\/(.+?) b\/(.+)$/);
    if (!headerMatch) return null;

    const oldPath = headerMatch[1] ?? "";
    const newPath = headerMatch[2] ?? "";

    let status: FileDiff["status"] = "modified";
    let isBinary = false;

    // Detect status from index/new/deleted markers
    for (const line of lines.slice(1, 10)) {
      if (line.startsWith("new file mode")) {
        status = "added";
      } else if (line.startsWith("deleted file mode")) {
        status = "deleted";
      } else if (line.startsWith("rename from")) {
        status = "renamed";
      } else if (line.startsWith("Binary files")) {
        isBinary = true;
      }
    }

    const hunks: DiffHunk[] = [];
    let totalAdded = 0;
    let totalRemoved = 0;

    if (!isBinary) {
      // Parse hunks
      let currentHunk: DiffHunk | null = null;
      let oldLine = 0;
      let newLine = 0;

      for (const line of lines) {
        const hunkMatch = line.match(
          /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/,
        );
        if (hunkMatch) {
          if (currentHunk) hunks.push(currentHunk);
          oldLine = parseInt(hunkMatch[1] ?? "0", 10);
          newLine = parseInt(hunkMatch[3] ?? "0", 10);
          currentHunk = {
            oldStart: oldLine,
            oldCount: parseInt(hunkMatch[2] ?? "1", 10),
            newStart: newLine,
            newCount: parseInt(hunkMatch[4] ?? "1", 10),
            header: hunkMatch[5]?.trim() ?? "",
            lines: [],
          };
          continue;
        }

        if (!currentHunk) continue;

        if (line.startsWith("+") && !line.startsWith("+++")) {
          currentHunk.lines.push({
            type: "add",
            content: line.slice(1),
            oldLineNo: null,
            newLineNo: newLine,
          });
          newLine++;
          totalAdded++;
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          currentHunk.lines.push({
            type: "remove",
            content: line.slice(1),
            oldLineNo: oldLine,
            newLineNo: null,
          });
          oldLine++;
          totalRemoved++;
        } else if (line.startsWith(" ")) {
          currentHunk.lines.push({
            type: "context",
            content: line.slice(1),
            oldLineNo: oldLine,
            newLineNo: newLine,
          });
          oldLine++;
          newLine++;
        }
      }

      if (currentHunk) hunks.push(currentHunk);
    }

    return {
      filePath: newPath,
      oldPath: status === "renamed" ? (oldPath ?? null) : null,
      status,
      hunks,
      linesAdded: totalAdded,
      linesRemoved: totalRemoved,
      isBinary,
    };
  }
}
