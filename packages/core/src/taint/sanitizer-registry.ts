import type { TaintCategory } from "./taint-types.js";

interface SanitizerPatternEntry {
  pattern: RegExp;
  sanitizes: TaintCategory[];
  description: string;
}

/**
 * Registry of sanitizer patterns.
 * Sanitizers are functions/operations that neutralize tainted data.
 */
export class SanitizerRegistry {
  private readonly patterns: SanitizerPatternEntry[] = [
    // Validation frameworks
    {
      pattern: /\.parse\(|\.safeParse\(/,
      sanitizes: [
        "sql_injection",
        "xss",
        "command_injection",
        "path_traversal",
      ],
      description: "Zod/schema parse",
    },
    {
      pattern: /\.validate\(/,
      sanitizes: ["sql_injection", "xss", "command_injection"],
      description: "Validation (Joi/Yup)",
    },
    {
      pattern: /express-validator|validationResult/,
      sanitizes: ["sql_injection", "xss"],
      description: "express-validator",
    },

    // Escaping
    {
      pattern: /escapeHtml|escape_html|htmlspecialchars/,
      sanitizes: ["xss"],
      description: "HTML escaping",
    },
    {
      pattern: /encodeURIComponent|encodeURI/,
      sanitizes: ["xss", "open_redirect"],
      description: "URL encoding",
    },
    {
      pattern: /DOMPurify|sanitize-html|bleach\.clean/,
      sanitizes: ["xss"],
      description: "HTML sanitizer library",
    },

    // Parameterized queries (indicates safe pattern)
    {
      pattern: /\?\s*[,)]|\$\d+|\%s/,
      sanitizes: ["sql_injection"],
      description: "Parameterized query placeholder",
    },
    {
      pattern: /\.prepare\(/,
      sanitizes: ["sql_injection"],
      description: "Prepared statement",
    },

    // Type coercion
    {
      pattern: /parseInt\(|Number\(|parseFloat\(/,
      sanitizes: ["sql_injection", "command_injection"],
      description: "Numeric type coercion",
    },
    {
      pattern: /String\(|\.toString\(\)/,
      sanitizes: ["sql_injection"],
      description: "String type coercion",
    },
    {
      pattern: /Boolean\(/,
      sanitizes: ["sql_injection", "xss", "command_injection"],
      description: "Boolean coercion",
    },

    // Path sanitization
    {
      pattern: /path\.resolve|path\.normalize|path\.basename/,
      sanitizes: ["path_traversal"],
      description: "Path normalization",
    },
    {
      pattern: /\.replace\(\s*['"]\.{2}['"]|\.includes\(\s*['"]\.{2}['"]/,
      sanitizes: ["path_traversal"],
      description: "Path traversal check",
    },

    // URL validation
    {
      pattern: /new\s+URL\(/,
      sanitizes: ["ssrf", "open_redirect"],
      description: "URL constructor validation",
    },

    // Cryptographic
    {
      pattern: /bcrypt|argon2|scrypt|pbkdf2/,
      sanitizes: ["pii_leak"],
      description: "Password hashing",
    },

    // Allowlist checks
    {
      pattern: /\.includes\(|\.indexOf\(|allowlist|whitelist/i,
      sanitizes: ["ssrf", "open_redirect", "command_injection"],
      description: "Allowlist check",
    },
  ];

  isSanitizer(code: string, category?: TaintCategory | null): boolean {
    return this.patterns.some((p) => {
      if (!p.pattern.test(code)) return false;
      if (category) return p.sanitizes.includes(category);
      return true;
    });
  }

  getSanitizedCategories(code: string): TaintCategory[] {
    const categories = new Set<TaintCategory>();
    for (const p of this.patterns) {
      if (p.pattern.test(code)) {
        for (const cat of p.sanitizes) {
          categories.add(cat);
        }
      }
    }
    return Array.from(categories);
  }

  addPattern(
    pattern: RegExp,
    sanitizes: TaintCategory[],
    description: string,
  ): void {
    this.patterns.push({ pattern, sanitizes, description });
  }
}
