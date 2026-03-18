import type { TaintCategory } from "./taint-types.js";

interface SourcePatternEntry {
  pattern: RegExp;
  category: TaintCategory;
  description: string;
}

/**
 * Registry of taint source patterns.
 * Sources are entry points where untrusted data enters the program.
 */
export class SourceRegistry {
  private readonly patterns: SourcePatternEntry[] = [
    // HTTP inputs
    {
      pattern: /req(?:uest)?\.body/,
      category: "sql_injection",
      description: "HTTP request body",
    },
    {
      pattern: /req(?:uest)?\.query/,
      category: "sql_injection",
      description: "HTTP query params",
    },
    {
      pattern: /req(?:uest)?\.params/,
      category: "sql_injection",
      description: "HTTP route params",
    },
    {
      pattern: /req(?:uest)?\.headers/,
      category: "ssrf",
      description: "HTTP request headers",
    },
    {
      pattern: /req(?:uest)?\.cookies/,
      category: "xss",
      description: "HTTP cookies",
    },
    {
      pattern: /request\.form/,
      category: "sql_injection",
      description: "Form data (Python)",
    },
    {
      pattern: /request\.args/,
      category: "sql_injection",
      description: "Query args (Flask)",
    },
    {
      pattern: /request\.GET|request\.POST/,
      category: "sql_injection",
      description: "Django request",
    },

    // Environment
    {
      pattern: /process\.env/,
      category: "ssrf",
      description: "Environment variable",
    },
    {
      pattern: /os\.environ/,
      category: "ssrf",
      description: "Environment variable (Python)",
    },
    {
      pattern: /System\.getenv/,
      category: "ssrf",
      description: "Environment variable (Java)",
    },
    {
      pattern: /os\.Getenv/,
      category: "ssrf",
      description: "Environment variable (Go)",
    },

    // Database reads (as a source for further propagation)
    {
      pattern: /\.find(?:One|Many|All|By)?\(/,
      category: "xss",
      description: "Database read",
    },
    {
      pattern: /\.query\(/,
      category: "xss",
      description: "Database query result",
    },
    { pattern: /\.select\(/, category: "xss", description: "Database select" },

    // File reads
    {
      pattern: /fs\.readFile/,
      category: "path_traversal",
      description: "File read (Node.js)",
    },
    { pattern: /open\(/, category: "path_traversal", description: "File open" },
    {
      pattern: /\.read\(\)/,
      category: "path_traversal",
      description: "File read",
    },

    // User input
    {
      pattern: /readline/,
      category: "command_injection",
      description: "User console input",
    },
    {
      pattern: /input\(/,
      category: "command_injection",
      description: "User input (Python)",
    },
    {
      pattern: /Scanner/,
      category: "command_injection",
      description: "User input (Java)",
    },

    // URL/API
    {
      pattern: /window\.location/,
      category: "open_redirect",
      description: "Browser URL",
    },
    {
      pattern: /document\.location/,
      category: "open_redirect",
      description: "Document location",
    },
    {
      pattern: /document\.cookie/,
      category: "xss",
      description: "Document cookies",
    },
    {
      pattern: /localStorage\.getItem/,
      category: "xss",
      description: "Local storage",
    },

    // Deserialization
    {
      pattern: /JSON\.parse\(/,
      category: "insecure_deserialization",
      description: "JSON.parse",
    },
    {
      pattern: /pickle\.loads?\(/,
      category: "insecure_deserialization",
      description: "Pickle load",
    },
    {
      pattern: /yaml\.load\(/,
      category: "insecure_deserialization",
      description: "YAML load",
    },
  ];

  isSource(code: string): boolean {
    return this.patterns.some((p) => p.pattern.test(code));
  }

  getCategory(code: string): TaintCategory | null {
    for (const p of this.patterns) {
      if (p.pattern.test(code)) return p.category;
    }
    return null;
  }

  getDescription(code: string): string | null {
    for (const p of this.patterns) {
      if (p.pattern.test(code)) return p.description;
    }
    return null;
  }

  /**
   * Add a custom source pattern.
   */
  addPattern(
    pattern: RegExp,
    category: TaintCategory,
    description: string,
  ): void {
    this.patterns.push({ pattern, category, description });
  }
}
