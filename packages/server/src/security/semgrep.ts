/**
 * Semgrep integration — optional SAST scanner.
 *
 * Shells out to the `semgrep` CLI if it's installed on the system.
 * Falls back gracefully when semgrep is not available.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
// Simple logger fallback — avoid deep import dependency
const log = {
  info: (meta: Record<string, unknown>, msg?: string) => { if (msg) console.log(`[semgrep] ${msg}`, meta); },
  warn: (meta: Record<string, unknown>, msg?: string) => { if (msg) console.warn(`[semgrep] ${msg}`, meta); },
};

const execFileAsync = promisify(execFile);

export interface SemgrepFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  description: string;
  fix: string;
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  code: string;
  rule: string;
}

interface SemgrepResult {
  results: Array<{
    check_id: string;
    path: string;
    start: { line: number; col: number };
    end: { line: number; col: number };
    extra: {
      message: string;
      severity: string;
      metadata?: {
        category?: string;
        cwe?: string[];
        owasp?: string[];
        fix?: string;
        confidence?: string;
      };
      lines?: string;
      fix?: string;
    };
  }>;
  errors: unknown[];
}

const SEVERITY_MAP: Record<string, SemgrepFinding["severity"]> = {
  ERROR: "critical",
  WARNING: "high",
  INFO: "medium",
  INVENTORY: "low",
};

const CATEGORY_MAP: Record<string, string> = {
  "injection": "sql_injection",
  "sql-injection": "sql_injection",
  "xss": "xss",
  "command-injection": "command_injection",
  "path-traversal": "path_traversal",
  "ssrf": "ssrf",
  "open-redirect": "open_redirect",
  "deserialization": "insecure_deserialization",
  "crypto": "hardcoded_secret",
  "auth": "missing_auth",
};

function mapCategory(checkId: string, metadata?: { category?: string }): string {
  if (metadata?.category) {
    const lower = metadata.category.toLowerCase();
    for (const [key, val] of Object.entries(CATEGORY_MAP)) {
      if (lower.includes(key)) return val;
    }
  }
  const lower = checkId.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return "security";
}

/** Check whether semgrep is available on the system. */
export async function isSemgrepAvailable(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("semgrep", ["--version"], {
      timeout: 5000,
    });
    log.info({ version: stdout.trim() }, "Semgrep available");
    return true;
  } catch {
    return false;
  }
}

/**
 * Run Semgrep against a repository path.
 * Uses the "auto" config which applies language-specific community rules.
 */
export async function runSemgrep(
  repoPath: string,
  options?: { timeout?: number; maxFindings?: number },
): Promise<SemgrepFinding[]> {
  const timeout = options?.timeout ?? 120_000;
  const maxFindings = options?.maxFindings ?? 500;

  try {
    const args = [
      "scan",
      "--config", "auto",
      "--json",
      "--quiet",
      "--no-git-ignore",  // We handle ignores ourselves
      "--max-target-bytes", "512000",
      "--timeout", "30",
      repoPath,
    ];

    log.info({ repoPath, args: args.join(" ") }, "Running Semgrep");

    const { stdout, stderr } = await execFileAsync("semgrep", args, {
      timeout,
      maxBuffer: 50 * 1024 * 1024,
      env: { ...process.env, SEMGREP_SEND_METRICS: "off" },
    });

    if (stderr) {
      log.warn({ stderr: stderr.slice(0, 500) }, "Semgrep stderr");
    }

    const parsed: SemgrepResult = JSON.parse(stdout);
    const findings: SemgrepFinding[] = [];
    let id = 1;

    for (const r of parsed.results) {
      if (findings.length >= maxFindings) break;

      const severity = SEVERITY_MAP[r.extra.severity?.toUpperCase()] ?? "medium";
      const category = mapCategory(r.check_id, r.extra.metadata);

      findings.push({
        id: `semgrep-${id++}`,
        severity,
        category,
        description: r.extra.message,
        fix: r.extra.fix ?? r.extra.metadata?.fix ?? `Review rule: ${r.check_id}`,
        file: r.path,
        line: r.start.line,
        column: r.start.col,
        endLine: r.end.line,
        endColumn: r.end.col,
        code: r.extra.lines ?? "",
        rule: r.check_id,
      });
    }

    log.info({ findingsCount: findings.length }, "Semgrep scan complete");
    return findings;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn({ error: message }, "Semgrep scan failed");
    return [];
  }
}
