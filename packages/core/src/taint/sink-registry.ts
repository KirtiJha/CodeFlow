import type { TaintCategory, TaintSeverity } from "./taint-types.js";

interface SinkPatternEntry {
  pattern: RegExp;
  category: TaintCategory;
  severity: TaintSeverity;
  description: string;
}

/**
 * Registry of taint sink patterns.
 * Sinks are dangerous operations where untrusted data could cause harm.
 */
export class SinkRegistry {
  private readonly patterns: SinkPatternEntry[] = [
    // SQL execution
    {
      pattern: /\.query\(.*\$\{/,
      category: "sql_injection",
      severity: "critical",
      description: "SQL query with interpolation",
    },
    {
      pattern: /\.raw\(/,
      category: "sql_injection",
      severity: "critical",
      description: "Raw SQL query",
    },
    {
      pattern: /cursor\.execute\(/,
      category: "sql_injection",
      severity: "critical",
      description: "SQL cursor execute",
    },
    {
      pattern: /\.exec(?:ute)?Sql\(/,
      category: "sql_injection",
      severity: "critical",
      description: "SQL execution",
    },
    {
      pattern: /db\.run\(/,
      category: "sql_injection",
      severity: "critical",
      description: "Database run",
    },

    // Command execution
    {
      pattern: /exec\(/,
      category: "command_injection",
      severity: "critical",
      description: "Command execution",
    },
    {
      pattern: /spawn\(/,
      category: "command_injection",
      severity: "critical",
      description: "Process spawn",
    },
    {
      pattern: /child_process/,
      category: "command_injection",
      severity: "critical",
      description: "Child process",
    },
    {
      pattern: /subprocess/,
      category: "command_injection",
      severity: "critical",
      description: "Subprocess (Python)",
    },
    {
      pattern: /os\.system\(/,
      category: "command_injection",
      severity: "critical",
      description: "OS command (Python)",
    },
    {
      pattern: /Runtime\.exec\(/,
      category: "command_injection",
      severity: "critical",
      description: "Runtime exec (Java)",
    },

    // XSS / HTML rendering
    {
      pattern: /innerHTML/,
      category: "xss",
      severity: "critical",
      description: "innerHTML assignment",
    },
    {
      pattern: /dangerouslySetInnerHTML/,
      category: "xss",
      severity: "critical",
      description: "React dangerouslySetInnerHTML",
    },
    {
      pattern: /document\.write\(/,
      category: "xss",
      severity: "critical",
      description: "document.write",
    },
    {
      pattern: /\.html\(/,
      category: "xss",
      severity: "warning",
      description: "jQuery .html()",
    },
    {
      pattern: /render\(.*\$\{/,
      category: "xss",
      severity: "warning",
      description: "Template render with interpolation",
    },

    // File operations
    {
      pattern: /fs\.writeFile/,
      category: "path_traversal",
      severity: "critical",
      description: "File write",
    },
    {
      pattern: /fs\.readFile/,
      category: "path_traversal",
      severity: "warning",
      description: "File read",
    },
    {
      pattern: /fs\.unlink/,
      category: "path_traversal",
      severity: "critical",
      description: "File delete",
    },
    {
      pattern: /\.createWriteStream\(/,
      category: "path_traversal",
      severity: "critical",
      description: "Write stream",
    },

    // Eval / dynamic code
    {
      pattern: /\beval\(/,
      category: "command_injection",
      severity: "critical",
      description: "eval()",
    },
    {
      pattern: /new\s+Function\(/,
      category: "command_injection",
      severity: "critical",
      description: "Function constructor",
    },
    {
      pattern: /vm\.runInContext/,
      category: "command_injection",
      severity: "critical",
      description: "VM code execution",
    },

    // URL / SSRF
    {
      pattern: /fetch\(/,
      category: "ssrf",
      severity: "warning",
      description: "fetch() with dynamic URL",
    },
    {
      pattern: /axios\.\w+\(/,
      category: "ssrf",
      severity: "warning",
      description: "axios with dynamic URL",
    },
    {
      pattern: /http\.get\(/,
      category: "ssrf",
      severity: "warning",
      description: "HTTP GET",
    },
    {
      pattern: /requests\.\w+\(/,
      category: "ssrf",
      severity: "warning",
      description: "Python requests",
    },

    // Redirect
    {
      pattern: /res\.redirect\(/,
      category: "open_redirect",
      severity: "warning",
      description: "HTTP redirect",
    },
    {
      pattern: /window\.location\s*=/,
      category: "open_redirect",
      severity: "warning",
      description: "Location assignment",
    },
    {
      pattern: /location\.href\s*=/,
      category: "open_redirect",
      severity: "warning",
      description: "Location href assignment",
    },

    // Logging with PII
    {
      pattern: /console\.log\(.*(?:email|password|ssn|phone|token|secret|key)/,
      category: "pii_leak",
      severity: "warning",
      description: "PII in console.log",
    },
    {
      pattern: /logger\.\w+\(.*(?:email|password|ssn|phone|token|secret|key)/,
      category: "pii_leak",
      severity: "warning",
      description: "PII in logger",
    },
  ];

  isSink(code: string): boolean {
    return this.patterns.some((p) => p.pattern.test(code));
  }

  getSinkInfo(
    code: string,
  ): { category: TaintCategory; severity: TaintSeverity } | null {
    for (const p of this.patterns) {
      if (p.pattern.test(code)) {
        return { category: p.category, severity: p.severity };
      }
    }
    return null;
  }

  getDescription(code: string): string | null {
    for (const p of this.patterns) {
      if (p.pattern.test(code)) return p.description;
    }
    return null;
  }

  addPattern(
    pattern: RegExp,
    category: TaintCategory,
    severity: TaintSeverity,
    description: string,
  ): void {
    this.patterns.push({ pattern, category, severity, description });
  }
}
