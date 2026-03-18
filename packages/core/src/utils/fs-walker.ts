import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import ignore, { type Ignore } from "ignore";
import { readFile } from "node:fs/promises";
import { isSupported } from "./language-detect.js";
import { normalizePath, toRelative } from "./path-utils.js";

export interface WalkOptions {
  root: string;
  respectGitignore?: boolean;
  supportedOnly?: boolean;
  maxFiles?: number;
  extraIgnorePatterns?: string[];
}

export interface WalkResult {
  files: string[];
  skippedDirs: number;
  totalFound: number;
}

const DEFAULT_IGNORE = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  "coverage",
  "__pycache__",
  ".tox",
  "venv",
  ".venv",
  "target",
  "bin/Debug",
  "bin/Release",
  "obj",
  ".idea",
  ".vscode",
  ".DS_Store",
  "*.lock",
  "package-lock.json",
  "*.min.js",
  "*.min.css",
  "*.map",
  "*.d.ts",
];

export async function walkDirectory(options: WalkOptions): Promise<WalkResult> {
  const {
    root,
    respectGitignore = true,
    supportedOnly = true,
    maxFiles = 50_000,
    extraIgnorePatterns = [],
  } = options;

  const ig = ignore();
  ig.add(DEFAULT_IGNORE);
  ig.add(extraIgnorePatterns);

  if (respectGitignore) {
    await loadGitignore(root, ig);
  }

  const files: string[] = [];
  let skippedDirs = 0;
  let totalFound = 0;

  async function walk(dir: string): Promise<void> {
    if (files.length >= maxFiles) return;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // Permission denied or deleted directory
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) return;

      const fullPath = join(dir, entry.name);
      const relPath = toRelative(fullPath, root);

      if (ig.ignores(relPath)) {
        if (entry.isDirectory()) skippedDirs++;
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        totalFound++;
        if (!supportedOnly || isSupported(fullPath)) {
          files.push(normalizePath(relPath));
        }
      }
    }
  }

  await walk(root);

  return { files, skippedDirs, totalFound };
}

async function loadGitignore(root: string, ig: Ignore): Promise<void> {
  try {
    const content = await readFile(join(root, ".gitignore"), "utf-8");
    ig.add(content);
  } catch {
    // No .gitignore — that's fine
  }
}

export async function getFileSize(filePath: string): Promise<number> {
  const s = await stat(filePath);
  return s.size;
}
