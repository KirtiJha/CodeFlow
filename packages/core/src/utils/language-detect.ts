import type { Language } from "../graph/types.js";
import { extname } from "node:path";

const EXTENSION_MAP: Record<string, Language> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".pyw": "python",
  ".java": "java",
  ".go": "go",
  ".rs": "rust",
  ".cs": "csharp",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".php": "php",
  ".rb": "ruby",
  ".swift": "swift",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".hh": "cpp",
  ".hxx": "cpp",
};

const FILENAME_MAP: Record<string, Language> = {
  Gemfile: "ruby",
  Rakefile: "ruby",
  Podfile: "ruby",
  Makefile: "c",
  "CMakeLists.txt": "cpp",
};

const SUPPORTED_LANGUAGES = new Set<Language>([
  "typescript",
  "javascript",
  "python",
  "java",
  "go",
  "rust",
  "csharp",
  "kotlin",
  "php",
  "ruby",
  "swift",
  "c",
  "cpp",
]);

export function detectLanguage(filePath: string): Language | null {
  const ext = extname(filePath).toLowerCase();
  const lang = EXTENSION_MAP[ext];
  if (lang) return lang;

  const basename = filePath.split("/").pop() ?? "";
  return FILENAME_MAP[basename] ?? null;
}

export function isSupported(filePath: string): boolean {
  return detectLanguage(filePath) !== null;
}

export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_MAP);
}

export function getSupportedLanguages(): Language[] {
  return [...SUPPORTED_LANGUAGES];
}

export function getExtensionsForLanguage(language: Language): string[] {
  return Object.entries(EXTENSION_MAP)
    .filter(([, lang]) => lang === language)
    .map(([ext]) => ext);
}
