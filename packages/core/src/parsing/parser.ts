import Parser from "tree-sitter";
import { readFile } from "node:fs/promises";
import { createLogger } from "../utils/logger.js";
import { ASTCache } from "../utils/ast-cache.js";
import { detectLanguage } from "../utils/language-detect.js";
import { loadLanguage } from "./language-loader.js";
import type {
  Language,
  ParseResult,
  ExtractedSymbol,
  ExtractedImport,
  ExtractedCall,
  ExtractedHeritage,
} from "../graph/types.js";
import { createHash } from "node:crypto";

const log = createLogger("parsing:parser");

export class CodeParser {
  private readonly parser: Parser;
  private readonly cache: ASTCache;
  private currentLanguage: Language | null = null;

  constructor(cacheSize = 500) {
    this.parser = new Parser();
    this.cache = new ASTCache({ maxEntries: cacheSize });
  }

  /**
   * Parse source code from a file path and content.
   * Uses caching to avoid re-parsing unchanged files.
   */
  parse(filePath: string, content: string): Parser.Tree | null {
    const lang = detectLanguage(filePath);
    if (!lang) {
      log.debug({ filePath }, "Unsupported language");
      return null;
    }

    const contentHash = hashContent(content);

    // Check cache
    const cached = this.cache.get(filePath, contentHash);
    if (cached) return cached;

    // Set language if changed
    if (lang !== this.currentLanguage) {
      const grammar = loadLanguage(lang);
      if (!grammar) {
        log.warn({ lang, filePath }, "Failed to load language grammar");
        return null;
      }
      this.parser.setLanguage(grammar as never);
      this.currentLanguage = lang;
    }

    try {
      const tree = this.parser.parse(content);
      this.cache.set(filePath, tree, contentHash);
      return tree;
    } catch (err) {
      log.error({ err, filePath }, "Parse error");
      return null;
    }
  }

  /**
   * Incrementally re-parse after an edit.
   */
  reparse(
    filePath: string,
    content: string,
    oldTree: Parser.Tree,
  ): Parser.Tree | null {
    const lang = detectLanguage(filePath);
    if (!lang) return null;

    if (lang !== this.currentLanguage) {
      const grammar = loadLanguage(lang);
      if (!grammar) return null;
      this.parser.setLanguage(grammar as never);
      this.currentLanguage = lang;
    }

    try {
      const tree = this.parser.parse(content, oldTree);
      const contentHash = hashContent(content);
      this.cache.set(filePath, tree, contentHash);
      return tree;
    } catch (err) {
      log.error({ err, filePath }, "Incremental parse error");
      return this.parse(filePath, content);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  /** No-op: parser initializes in constructor. */
  async initialize(): Promise<void> {}

  /**
   * Parse content string directly without needing a file path.
   * Used by diff-analyzer and similar utilities.
   */
  parseContent(content: string, language: Language): Parser.Tree | null {
    const grammar = loadLanguage(language);
    if (!grammar) return null;
    if (language !== this.currentLanguage) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.parser.setLanguage(grammar as any);
      this.currentLanguage = language;
    }
    try {
      return this.parser.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Parse a file from disk and extract symbols, imports, calls, and heritage.
   */
  async parseFile(filePath: string): Promise<ParseResult> {
    const content = await readFile(filePath, "utf-8");
    const lang = detectLanguage(filePath);
    if (!lang) {
      return {
        filePath,
        language: "typescript",
        symbols: [],
        imports: [],
        calls: [],
        heritage: [],
      };
    }
    return this._extractFromContent(content, lang, filePath);
  }

  /**
   * Parse source content with explicit language — for worker threads.
   */
  parseSource(
    content: string,
    language: Language | string,
    filePath: string = "<anonymous>",
  ): ParseResult & { errors: string[] } {
    const lang = language as Language;
    const result = this._extractFromContent(content, lang, filePath);
    return { ...result, errors: [] };
  }

  private _extractFromContent(
    content: string,
    lang: Language,
    filePath: string,
  ): ParseResult {
    const tree = this.parseContent(content, lang);
    if (!tree) {
      return {
        filePath,
        language: lang,
        symbols: [],
        imports: [],
        calls: [],
        heritage: [],
      };
    }
    return this._runExtractors(tree, lang, filePath);
  }

  private _runExtractors(
    tree: Parser.Tree,
    lang: Language,
    filePath: string,
  ): ParseResult {
    // Lazy-load extractor for this language
    const extractor = this._getExtractor(lang);
    if (!extractor) {
      return {
        filePath,
        language: lang,
        symbols: [],
        imports: [],
        calls: [],
        heritage: [],
      };
    }
    return extractor.extract(tree, filePath);
  }

  private _extractorCache = new Map<
    Language,
    { extract(tree: Parser.Tree, filePath: string): ParseResult } | null
  >();

  private _getExtractor(
    lang: Language,
  ): { extract(tree: Parser.Tree, filePath: string): ParseResult } | null {
    if (this._extractorCache.has(lang)) return this._extractorCache.get(lang)!;
    // Synchronously require extractors (they are simple TS classes)
    try {
      let extractor: {
        extract(tree: Parser.Tree, filePath: string): ParseResult;
      } | null = null;
      if (lang === "typescript" || lang === "javascript") {
        const {
          TypeScriptExtractor,
        } = require("./extractors/typescript-extractor.js");
        extractor = new TypeScriptExtractor();
      } else if (lang === "python") {
        const { PythonExtractor } = require("./extractors/python-extractor.js");
        extractor = new PythonExtractor();
      } else if (lang === "java") {
        const { JavaExtractor } = require("./extractors/java-extractor.js");
        extractor = new JavaExtractor();
      } else if (lang === "go") {
        const { GoExtractor } = require("./extractors/go-extractor.js");
        extractor = new GoExtractor();
      }
      this._extractorCache.set(lang, extractor);
      return extractor;
    } catch {
      this._extractorCache.set(lang, null);
      return null;
    }
  }
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}
