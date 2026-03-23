/**
 * File-based security scanner.
 *
 * Reads actual source files from disk and applies regex patterns
 * against real code lines (not function signatures). This catches
 * real issues like SQL injection, XSS, hardcoded secrets, etc.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative, extname, basename } from "node:path";
// Simple logger fallback
const log = {
  info: (meta: Record<string, unknown>, msg?: string) => { if (msg) console.log(`[file-scanner] ${msg}`, meta); },
  warn: (meta: Record<string, unknown>, msg?: string) => { if (msg) console.warn(`[file-scanner] ${msg}`, meta); },
};

export interface ScanFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  description: string;
  fix: string;
  source: LocationInfo;
  sink: LocationInfo;
  path: LocationInfo[];
}

export interface LocationInfo {
  file: string;
  line: number;
  column: number;
  name: string;
  kind: string;
  symbol: string;
}

/* ── Pattern definitions for line-level scanning ─────────────── */

interface LinePattern {
  pattern: RegExp;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  fix: string;
  kind: "source" | "sink" | "secret" | "config";
}

const LINE_PATTERNS: LinePattern[] = [
  // ── SQL Injection ──
  { pattern: /\.query\s*\(\s*[`"'].*\$\{/, category: "sql_injection", severity: "critical", description: "SQL query with template literal interpolation", fix: "Use parameterized queries instead of string interpolation", kind: "sink" },
  { pattern: /\.query\s*\(\s*['"].*\+\s*/, category: "sql_injection", severity: "critical", description: "SQL query with string concatenation", fix: "Use parameterized queries with ? or $1 placeholders", kind: "sink" },
  { pattern: /\.raw\s*\(/, category: "sql_injection", severity: "high", description: "Raw SQL query — may be vulnerable to injection", fix: "Use parameterized queries; validate inputs if raw SQL is necessary", kind: "sink" },
  { pattern: /\.exec(?:ute)?Sql\s*\(/, category: "sql_injection", severity: "high", description: "Direct SQL execution", fix: "Use parameterized queries instead", kind: "sink" },
  { pattern: /db\.run\s*\(\s*[`"'].*\$\{/, category: "sql_injection", severity: "critical", description: "SQLite run() with interpolated query", fix: "Use ? placeholders in the query string", kind: "sink" },

  // ── Command Injection ──
  { pattern: /\bexec\s*\(\s*[`"'].*\$\{/, category: "command_injection", severity: "critical", description: "Shell command with template literal interpolation", fix: "Use execFile() with argument arrays; avoid string commands", kind: "sink" },
  { pattern: /\bexec\s*\(\s*['"].*\+\s*/, category: "command_injection", severity: "critical", description: "Shell command with string concatenation", fix: "Use execFile() with argument arrays; validate all inputs", kind: "sink" },
  { pattern: /child_process.*\bexec\b/, category: "command_injection", severity: "high", description: "child_process.exec() usage", fix: "Prefer execFile() or spawn() with explicit argument arrays", kind: "sink" },
  { pattern: /\bspawn\s*\(\s*[`"'].*\$\{/, category: "command_injection", severity: "critical", description: "Process spawn with interpolated command", fix: "Use shell: false and pass arguments as array", kind: "sink" },
  { pattern: /\beval\s*\(/, category: "command_injection", severity: "critical", description: "eval() usage — allows arbitrary code execution", fix: "Remove eval(); use safer alternatives like JSON.parse() or a sandboxed VM", kind: "sink" },
  { pattern: /new\s+Function\s*\(/, category: "command_injection", severity: "critical", description: "new Function() — dynamic code generation", fix: "Avoid dynamic function creation; use static code patterns", kind: "sink" },

  // ── XSS ──
  { pattern: /\.innerHTML\s*=/, category: "xss", severity: "critical", description: "innerHTML assignment — may execute injected scripts", fix: "Use textContent instead; or sanitize with DOMPurify", kind: "sink" },
  { pattern: /dangerouslySetInnerHTML/, category: "xss", severity: "critical", description: "React dangerouslySetInnerHTML — bypasses XSS protection", fix: "Sanitize HTML with DOMPurify before passing to dangerouslySetInnerHTML", kind: "sink" },
  { pattern: /document\.write\s*\(/, category: "xss", severity: "critical", description: "document.write() — can inject arbitrary HTML", fix: "Use DOM manipulation methods instead of document.write()", kind: "sink" },
  { pattern: /\.html\s*\(\s*[^)]/, category: "xss", severity: "medium", description: "jQuery .html() — may render unescaped content", fix: "Use .text() for plain text; sanitize HTML input with DOMPurify", kind: "sink" },

  // ── Path Traversal ──
  { pattern: /fs\.(readFile|writeFile|unlink|rmdir|mkdir)\w*\s*\(\s*[`"'].*\$\{/, category: "path_traversal", severity: "critical", description: "File system operation with interpolated path", fix: "Validate and normalize paths; reject paths containing '..'", kind: "sink" },
  { pattern: /fs\.(readFile|writeFile|unlink|rmdir|mkdir)\w*\s*\(\s*\w+[\s,]/, category: "path_traversal", severity: "medium", description: "File system operation with variable path", fix: "Validate path against allowed directories; use path.resolve() + allowlist", kind: "sink" },
  { pattern: /createWriteStream\s*\(/, category: "path_traversal", severity: "high", description: "Write stream with potentially unvalidated path", fix: "Validate the file path before creating a write stream", kind: "sink" },

  // ── SSRF ──
  { pattern: /fetch\s*\(\s*[`"'].*\$\{/, category: "ssrf", severity: "high", description: "fetch() with interpolated URL", fix: "Validate and allowlist target URLs; block internal network addresses", kind: "sink" },
  { pattern: /axios\.\w+\s*\(\s*[`"'].*\$\{/, category: "ssrf", severity: "high", description: "Axios request with interpolated URL", fix: "Validate and allowlist target URLs; block internal network addresses", kind: "sink" },
  { pattern: /http\.get\s*\(\s*[`"'].*\$\{/, category: "ssrf", severity: "high", description: "HTTP request with interpolated URL", fix: "Validate and allowlist target URLs; block internal network addresses", kind: "sink" },

  // ── Open Redirect ──
  { pattern: /res\.redirect\s*\(\s*(?:req\.|params|query|body)/, category: "open_redirect", severity: "high", description: "Redirect using user-controlled input", fix: "Validate redirect targets against an allowlist of safe domains", kind: "sink" },
  { pattern: /window\.location\s*=\s*(?!['"]https?:\/\/)/, category: "open_redirect", severity: "medium", description: "Dynamic window.location assignment", fix: "Validate and allowlist URLs before redirecting", kind: "sink" },

  // ── Hardcoded Secrets ──
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}["']/, category: "hardcoded_secret", severity: "high", description: "Hardcoded password in source code", fix: "Store passwords in environment variables or a secret vault", kind: "secret" },
  { pattern: /(?:api[_-]?key|apiKey)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/, category: "hardcoded_secret", severity: "high", description: "Hardcoded API key in source code", fix: "Store API keys in environment variables or a secret vault", kind: "secret" },
  { pattern: /(?:secret|token|auth[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_\-/.+=]{16,}["']/, category: "hardcoded_secret", severity: "high", description: "Hardcoded secret/token in source code", fix: "Store secrets in environment variables or a vault, never in code", kind: "secret" },
  { pattern: /(?:AWS|AZURE|GCP|GITHUB)[_A-Z]*(?:KEY|SECRET|TOKEN)\s*[:=]\s*["'][^"']+["']/, category: "hardcoded_secret", severity: "critical", description: "Hardcoded cloud provider credential", fix: "Use cloud IAM roles or environment variables for credentials", kind: "secret" },
  { pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/, category: "hardcoded_secret", severity: "critical", description: "Private key embedded in source code", fix: "Store private keys in secure key management; never commit to source", kind: "secret" },
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/, category: "hardcoded_secret", severity: "high", description: "Hardcoded Bearer token", fix: "Load tokens from environment variables at runtime", kind: "secret" },

  // ── PII Leak ──
  { pattern: /console\.log\s*\(.*(?:password|secret|token|ssn|email|phone)/, category: "pii_leak", severity: "medium", description: "Possible PII or secret logged to console", fix: "Mask or redact sensitive data before logging", kind: "sink" },
  { pattern: /logger\.\w+\s*\(.*(?:password|secret|token|ssn|email|phone)/, category: "pii_leak", severity: "medium", description: "Possible PII or secret in logger output", fix: "Use structured logging with field redaction for sensitive data", kind: "sink" },

  // ── Insecure Deserialization ──
  { pattern: /JSON\.parse\s*\(\s*(?:req\.|params|query|body|Buffer)/, category: "insecure_deserialization", severity: "medium", description: "JSON.parse on potentially untrusted input", fix: "Validate deserialized data with a schema (Zod, Joi, etc.)", kind: "sink" },
  { pattern: /yaml\.load\s*\(/, category: "insecure_deserialization", severity: "high", description: "YAML load — may allow code execution (Python)", fix: "Use yaml.safe_load() instead of yaml.load()", kind: "sink" },
  { pattern: /pickle\.loads?\s*\(/, category: "insecure_deserialization", severity: "critical", description: "Pickle deserialization — allows arbitrary code execution", fix: "Use JSON or a safer serialization format instead of pickle", kind: "sink" },

  // ── Prototype Pollution ──
  { pattern: /Object\.assign\s*\(\s*{}\s*,\s*(?:req\.|params|query|body)/, category: "prototype_pollution", severity: "medium", description: "Object.assign from user input — prototype pollution risk", fix: "Use Object.create(null) or validate property names against allowlist", kind: "sink" },
  { pattern: /\[(?:req|params|query|body)\.\w+\]/, category: "prototype_pollution", severity: "medium", description: "Dynamic property access with user input", fix: "Validate property names; reject __proto__, constructor, prototype", kind: "sink" },

  // ── Unsafe Regex ──
  { pattern: /new RegExp\s*\(\s*(?:req\.|params|query|body|user)/, category: "unsafe_regex", severity: "medium", description: "RegExp constructed from user input — ReDoS risk", fix: "Use a safe regex library or sanitize/escape user input", kind: "sink" },

  // ── Missing Auth / Security Config ──
  { pattern: /cors\s*\(\s*\)/, category: "missing_auth", severity: "medium", description: "CORS enabled with default (permissive) settings", fix: "Configure CORS with specific allowed origins", kind: "config" },
  { pattern: /helmet\s*\(\s*\{[^}]*contentSecurityPolicy\s*:\s*false/, category: "missing_auth", severity: "medium", description: "Content Security Policy disabled", fix: "Enable CSP; configure directives appropriate for your app", kind: "config" },
];

/* ── File extensions to scan ────────────────────────────────── */

const SCAN_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".java", ".go", ".rs", ".rb", ".php",
  ".c", ".cpp", ".cs", ".kt", ".swift",
]);

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out",
  ".next", ".nuxt", "coverage", "__pycache__",
  ".codeflow", "vendor", ".venv", "venv",
]);

const FIX_MAP: Record<string, string> = {
  sql_injection: "Use parameterized queries instead of string concatenation",
  xss: "Sanitize user input before rendering; use DOMPurify",
  command_injection: "Use allowlist validation; avoid dynamic command construction",
  path_traversal: "Validate and normalize file paths; reject paths with '..'",
  pii_leak: "Mask or redact PII before logging",
  ssrf: "Validate and allowlist target URLs",
  open_redirect: "Validate redirect targets against an allowlist of safe domains",
  insecure_deserialization: "Validate deserialized data with schema validation",
  prototype_pollution: "Use Object.create(null); validate property names",
  log_injection: "Strip control characters from log inputs",
  hardcoded_secret: "Store secrets in environment variables or a vault",
  missing_auth: "Add authentication/authorization checks",
  unsafe_regex: "Audit regex for ReDoS; use a safe regex library",
  security: "Review this code for security issues",
};

/* ── Scanner implementation ──────────────────────────────────── */

function collectFiles(dir: string, rootDir: string, files: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env") continue;
    if (IGNORE_DIRS.has(entry.name)) continue;

    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, rootDir, files);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (SCAN_EXTENSIONS.has(ext)) {
        files.push(fullPath);
      }
    }
  }
}

function shortPath(full: string, root: string): string {
  return relative(root, full);
}

export function scanFiles(repoPath: string): ScanFinding[] {
  const files: string[] = [];
  collectFiles(repoPath, repoPath, files);

  log.info({ fileCount: files.length, repoPath }, "Starting file-based security scan");

  const findings: ScanFinding[] = [];
  let findingId = 1;

  for (const filePath of files) {
    // Skip test files
    const relPath = shortPath(filePath, repoPath);
    const name = basename(filePath);
    if (
      relPath.includes("__tests__") ||
      relPath.includes("/test/") ||
      relPath.includes("/tests/") ||
      relPath.includes(".test.") ||
      relPath.includes(".spec.") ||
      name.startsWith("test_")
    ) {
      continue;
    }

    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx]!;

      // Skip comments (basic heuristic)
      const trimmed = line.trimStart();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("#")) {
        continue;
      }

      for (const pattern of LINE_PATTERNS) {
        if (pattern.pattern.test(line)) {
          const loc: LocationInfo = {
            file: relPath,
            line: lineIdx + 1,
            column: 0,
            name: name,
            kind: pattern.kind,
            symbol: trimmed.slice(0, 80),
          };

          findings.push({
            id: `scan-${findingId++}`,
            severity: pattern.severity,
            category: pattern.category,
            description: pattern.description,
            fix: pattern.fix,
            source: loc,
            sink: loc,
            path: [loc],
          });
          break; // One finding per line
        }
      }
    }
  }

  // Sort: critical first
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));

  log.info({ findings: findings.length }, "File-based scan complete");
  return findings;
}
