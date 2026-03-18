import type { Language } from "../../graph/types.js";
import { BaseExtractor } from "./base-extractor.js";
import { TypeScriptExtractor } from "./typescript-extractor.js";
import { PythonExtractor } from "./python-extractor.js";
import { JavaExtractor } from "./java-extractor.js";
import { GoExtractor } from "./go-extractor.js";

const extractors = new Map<Language, BaseExtractor>();

function lazyInit(): void {
  if (extractors.size > 0) return;
  const ts = new TypeScriptExtractor();
  extractors.set("typescript", ts);
  extractors.set("javascript", ts); // JS uses same extractor
  extractors.set("python", new PythonExtractor());
  extractors.set("java", new JavaExtractor());
  extractors.set("go", new GoExtractor());
}

export function getExtractor(language: Language): BaseExtractor | null {
  lazyInit();
  return extractors.get(language) ?? null;
}

export function getSupportedExtractorLanguages(): Language[] {
  lazyInit();
  return [...extractors.keys()];
}

export { BaseExtractor } from "./base-extractor.js";
export { TypeScriptExtractor } from "./typescript-extractor.js";
export { PythonExtractor } from "./python-extractor.js";
export { JavaExtractor } from "./java-extractor.js";
export { GoExtractor } from "./go-extractor.js";
