import { createRequire } from "node:module";
import type { Language } from "../graph/types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("parsing:language-loader");

const nativeRequire = createRequire(import.meta.url);

type Grammar = unknown; // tree-sitter grammar type

const loadedGrammars = new Map<Language, Grammar>();

const GRAMMAR_PACKAGES: Record<Language, string> = {
  typescript: "tree-sitter-typescript",
  javascript: "tree-sitter-javascript",
  python: "tree-sitter-python",
  java: "tree-sitter-java",
  go: "tree-sitter-go",
  rust: "tree-sitter-rust",
  csharp: "tree-sitter-c-sharp",
  kotlin: "tree-sitter-kotlin",
  php: "tree-sitter-php",
  ruby: "tree-sitter-ruby",
  swift: "tree-sitter-swift",
  c: "tree-sitter-c",
  cpp: "tree-sitter-cpp",
};

/**
 * Dynamically load a tree-sitter language grammar.
 * Returns null if the grammar package is not installed.
 */
export function loadLanguage(lang: Language): Grammar | null {
  const cached = loadedGrammars.get(lang);
  if (cached) return cached;

  const packageName = GRAMMAR_PACKAGES[lang];
  if (!packageName) {
    log.warn({ lang }, "No grammar package configured");
    return null;
  }

  try {
    // Native require for CJS tree-sitter grammar modules in ESM context
    const mod = nativeRequire(packageName);

    // Some packages export the language directly, others wrap it
    let grammar: Grammar;
    if (lang === "typescript") {
      // tree-sitter-typescript exports { typescript, tsx }
      grammar = mod.typescript ?? mod;
    } else if (lang === "php") {
      // tree-sitter-php exports { php }
      grammar = mod.php ?? mod;
    } else {
      grammar = mod;
    }

    loadedGrammars.set(lang, grammar);
    log.debug({ lang, packageName }, "Language grammar loaded");
    return grammar;
  } catch (err) {
    log.warn(
      { lang, packageName, err },
      "Failed to load grammar — is the package installed?",
    );
    return null;
  }
}

/**
 * Check if a language grammar is available.
 */
export function isLanguageAvailable(lang: Language): boolean {
  if (loadedGrammars.has(lang)) return true;
  const grammar = loadLanguage(lang);
  return grammar !== null;
}

/**
 * Get all currently loaded languages.
 */
export function getLoadedLanguages(): Language[] {
  return [...loadedGrammars.keys()];
}
