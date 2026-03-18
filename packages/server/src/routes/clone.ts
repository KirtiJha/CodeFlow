import { Hono } from "hono";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { homedir } from "node:os";
import type { AppEnv } from "../types.js";

const execFileAsync = promisify(execFile);

const CLONE_BASE = resolve(homedir(), ".codeflow", "repos");

/** Validate and extract org/repo from a GitHub URL */
function parseGitHubUrl(input: string): { org: string; repo: string } | null {
  // Match https://github.com/org/repo or https://github.com/org/repo.git
  const httpsMatch = input.match(
    /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/
  );
  if (httpsMatch) return { org: httpsMatch[1]!, repo: httpsMatch[2]! };

  // Match git@github.com:org/repo.git
  const sshMatch = input.match(
    /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/
  );
  if (sshMatch) return { org: sshMatch[1]!, repo: sshMatch[2]! };

  return null;
}

export const cloneRoutes = new Hono<AppEnv>();

cloneRoutes.post("/clone", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { url?: string };
  const url = body.url?.trim();

  if (!url) {
    return c.json({ error: "Missing 'url' field" }, 400);
  }

  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    return c.json({ error: "Invalid GitHub URL" }, 400);
  }

  const cloneDir = resolve(CLONE_BASE, parsed.org, parsed.repo);

  // If already cloned, just pull latest
  if (existsSync(resolve(cloneDir, ".git"))) {
    try {
      await execFileAsync("git", ["-C", cloneDir, "pull", "--ff-only"], {
        timeout: 60_000,
      });
    } catch {
      // pull may fail on diverged branches — that's ok, repo is still usable
    }
    return c.json({
      data: { repoPath: cloneDir, alreadyCloned: true },
    });
  }

  // Clone fresh
  try {
    // Only clone https URLs for security (no arbitrary command injection)
    const cloneUrl = `https://github.com/${parsed.org}/${parsed.repo}.git`;
    await execFileAsync(
      "git",
      ["clone", "--depth", "50", cloneUrl, cloneDir],
      { timeout: 120_000 }
    );

    return c.json({
      data: { repoPath: cloneDir, alreadyCloned: false },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Clone failed";
    return c.json({ error: `Failed to clone repository: ${message}` }, 500);
  }
});
