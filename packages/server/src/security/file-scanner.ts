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
  /** Human-readable label for what the dangerous API / pattern is */
  sinkLabel?: string;
  /** Human-readable label for where the untrusted data comes from */
  sourceLabel?: string;
}

const LINE_PATTERNS: LinePattern[] = [
  // ── SQL Injection ──
  { pattern: /\.query\s*\(\s*[`"'].*\$\{/, category: "sql_injection", severity: "critical", description: "SQL query with template literal interpolation", fix: "Use parameterized queries instead of string interpolation", kind: "sink", sinkLabel: ".query()", sourceLabel: "template interpolation" },
  { pattern: /\.query\s*\(\s*['"].*\+\s*/, category: "sql_injection", severity: "critical", description: "SQL query with string concatenation", fix: "Use parameterized queries with ? or $1 placeholders", kind: "sink", sinkLabel: ".query()", sourceLabel: "string concatenation" },
  { pattern: /\.raw\s*\(/, category: "sql_injection", severity: "high", description: "Raw SQL query — may be vulnerable to injection", fix: "Use parameterized queries; validate inputs if raw SQL is necessary", kind: "sink", sinkLabel: ".raw()", sourceLabel: "raw SQL input" },
  { pattern: /\.exec(?:ute)?Sql\s*\(/, category: "sql_injection", severity: "high", description: "Direct SQL execution", fix: "Use parameterized queries instead", kind: "sink", sinkLabel: ".executeSql()", sourceLabel: "SQL statement" },
  { pattern: /db\.run\s*\(\s*[`"'].*\$\{/, category: "sql_injection", severity: "critical", description: "SQLite run() with interpolated query", fix: "Use ? placeholders in the query string", kind: "sink", sinkLabel: "db.run()", sourceLabel: "template interpolation" },

  // ── Command Injection ──
  { pattern: /\bexec\s*\(\s*[`"'].*\$\{/, category: "command_injection", severity: "critical", description: "Shell command with template literal interpolation", fix: "Use execFile() with argument arrays; avoid string commands", kind: "sink", sinkLabel: "exec()", sourceLabel: "template interpolation" },
  { pattern: /\bexec\s*\(\s*['"].*\+\s*/, category: "command_injection", severity: "critical", description: "Shell command with string concatenation", fix: "Use execFile() with argument arrays; validate all inputs", kind: "sink", sinkLabel: "exec()", sourceLabel: "string concatenation" },
  { pattern: /child_process.*\bexec\b/, category: "command_injection", severity: "high", description: "child_process.exec() usage", fix: "Prefer execFile() or spawn() with explicit argument arrays", kind: "sink", sinkLabel: "child_process.exec()", sourceLabel: "shell command" },
  { pattern: /\bspawn\s*\(\s*[`"'].*\$\{/, category: "command_injection", severity: "critical", description: "Process spawn with interpolated command", fix: "Use shell: false and pass arguments as array", kind: "sink", sinkLabel: "spawn()", sourceLabel: "template interpolation" },
  { pattern: /\beval\s*\(/, category: "command_injection", severity: "critical", description: "eval() usage — allows arbitrary code execution", fix: "Remove eval(); use safer alternatives like JSON.parse() or a sandboxed VM", kind: "sink", sinkLabel: "eval()", sourceLabel: "dynamic code string" },
  { pattern: /new\s+Function\s*\(/, category: "command_injection", severity: "critical", description: "new Function() — dynamic code generation", fix: "Avoid dynamic function creation; use static code patterns", kind: "sink", sinkLabel: "new Function()", sourceLabel: "dynamic code string" },

  // ── XSS ──
  { pattern: /\.innerHTML\s*=/, category: "xss", severity: "critical", description: "innerHTML assignment — may execute injected scripts", fix: "Use textContent instead; or sanitize with DOMPurify", kind: "sink", sinkLabel: ".innerHTML", sourceLabel: "assigned value" },
  { pattern: /dangerouslySetInnerHTML/, category: "xss", severity: "critical", description: "React dangerouslySetInnerHTML — bypasses XSS protection", fix: "Sanitize HTML with DOMPurify before passing to dangerouslySetInnerHTML", kind: "sink", sinkLabel: "dangerouslySetInnerHTML", sourceLabel: "HTML content" },
  { pattern: /document\.write\s*\(/, category: "xss", severity: "critical", description: "document.write() — can inject arbitrary HTML", fix: "Use DOM manipulation methods instead of document.write()", kind: "sink", sinkLabel: "document.write()", sourceLabel: "HTML content" },
  { pattern: /\.html\s*\(\s*[^)]/, category: "xss", severity: "medium", description: "jQuery .html() — may render unescaped content", fix: "Use .text() for plain text; sanitize HTML input with DOMPurify", kind: "sink", sinkLabel: ".html()", sourceLabel: "HTML content" },

  // ── Path Traversal ──
  { pattern: /fs\.(readFile|writeFile|unlink|rmdir|mkdir)\w*\s*\(\s*[`"'].*\$\{/, category: "path_traversal", severity: "critical", description: "File system operation with interpolated path", fix: "Validate and normalize paths; reject paths containing '..'", kind: "sink", sinkLabel: "fs operation", sourceLabel: "interpolated path" },
  { pattern: /fs\.(readFile|writeFile|unlink|rmdir|mkdir)\w*\s*\(\s*\w+[\s,]/, category: "path_traversal", severity: "medium", description: "File system operation with variable path", fix: "Validate path against allowed directories; use path.resolve() + allowlist", kind: "sink", sinkLabel: "fs operation", sourceLabel: "variable path" },
  { pattern: /createWriteStream\s*\(/, category: "path_traversal", severity: "high", description: "Write stream with potentially unvalidated path", fix: "Validate the file path before creating a write stream", kind: "sink", sinkLabel: "createWriteStream()", sourceLabel: "file path argument" },

  // ── SSRF ──
  { pattern: /fetch\s*\(\s*[`"'].*\$\{/, category: "ssrf", severity: "high", description: "fetch() with interpolated URL", fix: "Validate and allowlist target URLs; block internal network addresses", kind: "sink", sinkLabel: "fetch()", sourceLabel: "interpolated URL" },
  { pattern: /axios\.\w+\s*\(\s*[`"'].*\$\{/, category: "ssrf", severity: "high", description: "Axios request with interpolated URL", fix: "Validate and allowlist target URLs; block internal network addresses", kind: "sink", sinkLabel: "axios request", sourceLabel: "interpolated URL" },
  { pattern: /http\.get\s*\(\s*[`"'].*\$\{/, category: "ssrf", severity: "high", description: "HTTP request with interpolated URL", fix: "Validate and allowlist target URLs; block internal network addresses", kind: "sink", sinkLabel: "http.get()", sourceLabel: "interpolated URL" },

  // ── Open Redirect ──
  { pattern: /res\.redirect\s*\(\s*(?:req\.|params|query|body)/, category: "open_redirect", severity: "high", description: "Redirect using user-controlled input", fix: "Validate redirect targets against an allowlist of safe domains", kind: "sink", sinkLabel: "res.redirect()", sourceLabel: "user input" },
  { pattern: /window\.location\s*=\s*(?!['"]https?:\/\/)/, category: "open_redirect", severity: "medium", description: "Dynamic window.location assignment", fix: "Validate and allowlist URLs before redirecting", kind: "sink", sinkLabel: "window.location", sourceLabel: "dynamic URL" },

  // ── Hardcoded Secrets ──
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}["']/, category: "hardcoded_secret", severity: "high", description: "Hardcoded password in source code", fix: "Store passwords in environment variables or a secret vault", kind: "secret", sinkLabel: "password assignment", sourceLabel: "hardcoded value" },
  { pattern: /(?:api[_-]?key|apiKey)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/, category: "hardcoded_secret", severity: "high", description: "Hardcoded API key in source code", fix: "Store API keys in environment variables or a secret vault", kind: "secret", sinkLabel: "API key assignment", sourceLabel: "hardcoded value" },
  { pattern: /(?:secret|token|auth[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_\-/.+=]{16,}["']/, category: "hardcoded_secret", severity: "high", description: "Hardcoded secret/token in source code", fix: "Store secrets in environment variables or a vault, never in code", kind: "secret", sinkLabel: "token/secret assignment", sourceLabel: "hardcoded value" },
  { pattern: /(?:AWS|AZURE|GCP|GITHUB)[_A-Z]*(?:KEY|SECRET|TOKEN)\s*[:=]\s*["'][^"']+["']/, category: "hardcoded_secret", severity: "critical", description: "Hardcoded cloud provider credential", fix: "Use cloud IAM roles or environment variables for credentials", kind: "secret", sinkLabel: "cloud credential", sourceLabel: "hardcoded value" },
  { pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/, category: "hardcoded_secret", severity: "critical", description: "Private key embedded in source code", fix: "Store private keys in secure key management; never commit to source", kind: "secret", sinkLabel: "private key", sourceLabel: "embedded key material" },
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/, category: "hardcoded_secret", severity: "high", description: "Hardcoded Bearer token", fix: "Load tokens from environment variables at runtime", kind: "secret", sinkLabel: "Authorization header", sourceLabel: "hardcoded Bearer token" },

  // ── PII Leak ──
  { pattern: /console\.log\s*\(.*(?:password|secret|token|ssn|email|phone)/, category: "pii_leak", severity: "medium", description: "Possible PII or secret logged to console", fix: "Mask or redact sensitive data before logging", kind: "sink", sinkLabel: "console.log()", sourceLabel: "sensitive data" },
  { pattern: /logger\.\w+\s*\(.*(?:password|secret|token|ssn|email|phone)/, category: "pii_leak", severity: "medium", description: "Possible PII or secret in logger output", fix: "Use structured logging with field redaction for sensitive data", kind: "sink", sinkLabel: "logger output", sourceLabel: "sensitive data" },

  // ── Insecure Deserialization ──
  { pattern: /JSON\.parse\s*\(\s*(?:req\.|params|query|body|Buffer)/, category: "insecure_deserialization", severity: "medium", description: "JSON.parse on potentially untrusted input", fix: "Validate deserialized data with a schema (Zod, Joi, etc.)", kind: "sink", sinkLabel: "JSON.parse()", sourceLabel: "untrusted input" },
  { pattern: /yaml\.load\s*\(/, category: "insecure_deserialization", severity: "high", description: "YAML load — may allow code execution (Python)", fix: "Use yaml.safe_load() instead of yaml.load()", kind: "sink", sinkLabel: "yaml.load()", sourceLabel: "YAML input" },
  { pattern: /pickle\.loads?\s*\(/, category: "insecure_deserialization", severity: "critical", description: "Pickle deserialization — allows arbitrary code execution", fix: "Use JSON or a safer serialization format instead of pickle", kind: "sink", sinkLabel: "pickle.load()", sourceLabel: "pickle input" },

  // ── Prototype Pollution ──
  { pattern: /Object\.assign\s*\(\s*{}\s*,\s*(?:req\.|params|query|body)/, category: "prototype_pollution", severity: "medium", description: "Object.assign from user input — prototype pollution risk", fix: "Use Object.create(null) or validate property names against allowlist", kind: "sink", sinkLabel: "Object.assign()", sourceLabel: "user input" },
  { pattern: /\[(?:req|params|query|body)\.\w+\]/, category: "prototype_pollution", severity: "medium", description: "Dynamic property access with user input", fix: "Validate property names; reject __proto__, constructor, prototype", kind: "sink", sinkLabel: "dynamic property access", sourceLabel: "user input" },

  // ── Unsafe Regex ──
  { pattern: /new RegExp\s*\(\s*(?:req\.|params|query|body|user)/, category: "unsafe_regex", severity: "medium", description: "RegExp constructed from user input — ReDoS risk", fix: "Use a safe regex library or sanitize/escape user input", kind: "sink", sinkLabel: "new RegExp()", sourceLabel: "user input" },

  // ── Missing Auth / Security Config ──
  { pattern: /cors\s*\(\s*\)/, category: "missing_auth", severity: "medium", description: "CORS enabled with default (permissive) settings", fix: "Configure CORS with specific allowed origins", kind: "config", sinkLabel: "cors()", sourceLabel: "default config" },
  { pattern: /helmet\s*\(\s*\{[^}]*contentSecurityPolicy\s*:\s*false/, category: "missing_auth", severity: "medium", description: "Content Security Policy disabled", fix: "Enable CSP; configure directives appropriate for your app", kind: "config", sinkLabel: "CSP disabled", sourceLabel: "helmet config" },
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
          const sinkLoc: LocationInfo = {
            file: relPath,
            line: lineIdx + 1,
            column: 0,
            name: name,
            kind: pattern.kind,
            symbol: trimmed.slice(0, 80),
          };

          const sourceLoc: LocationInfo = {
            file: relPath,
            line: lineIdx + 1,
            column: 0,
            name: pattern.sourceLabel ?? "input",
            kind: "source",
            symbol: pattern.sourceLabel ?? "untrusted data",
          };

          findings.push({
            id: `scan-${findingId++}`,
            severity: pattern.severity,
            category: pattern.category,
            description: pattern.description,
            fix: pattern.fix,
            source: sourceLoc,
            sink: sinkLoc,
            path: [
              sourceLoc,
              sinkLoc,
            ],
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
