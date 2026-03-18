import type { ExtractedImport } from "../graph/types.js";
import { normalizePath, dirName } from "../utils/path-utils.js";
import type { SymbolTable } from "./symbol-table.js";

/**
 * Resolves import paths to qualified names in the symbol table.
 */
export class ImportResolver {
  constructor(private readonly symbolTable: SymbolTable) {}

  /**
   * Build a map from local name → qualified name for all imports in a file.
   */
  buildImportMap(
    imports: ExtractedImport[],
    fromFile: string,
  ): Map<string, string> {
    const map = new Map<string, string>();

    for (const imp of imports) {
      const resolvedPath = this.resolveModulePath(imp.source ?? "", fromFile);

      for (const spec of imp.specifiers ?? []) {
        const localName = spec.alias ?? spec.name;

        if (spec.name === "default") {
          // Default import: look for the default export in the resolved file
          const symbols = this.symbolTable.getByFile(resolvedPath);
          const defaultExport = symbols.find((s) => s.isExported);
          if (defaultExport) {
            map.set(localName, defaultExport.qualifiedName);
          }
        } else if (spec.name === "*") {
          // Namespace import: we'll resolve members on access
          // Store a marker
          map.set(localName, `__namespace__:${resolvedPath}`);
        } else {
          // Named import: look up the specific symbol
          const symbols = this.symbolTable.getByFile(resolvedPath);
          const match = symbols.find(
            (s) => s.name === spec.name && s.isExported,
          );
          if (match) {
            map.set(localName, match.qualifiedName);
          }
        }
      }
    }

    return map;
  }

  /**
   * Resolve a module specifier to a file path.
   * Handles relative imports (./ ../) and bare specifiers.
   */
  private resolveModulePath(source: string, fromFile: string): string {
    if (source.startsWith(".")) {
      // Relative import
      const dir = dirName(fromFile);
      let resolved = normalizePath(`${dir}/${source}`);

      // Try common extensions
      const extensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".go"];
      for (const ext of extensions) {
        const withExt = resolved.endsWith(ext) ? resolved : resolved + ext;
        const symbols = this.symbolTable.getByFile(withExt);
        if (symbols.length > 0) return withExt;
      }

      // Try index file
      for (const ext of extensions) {
        const indexPath = normalizePath(`${resolved}/index${ext}`);
        const symbols = this.symbolTable.getByFile(indexPath);
        if (symbols.length > 0) return indexPath;
      }

      return resolved;
    }

    // Bare/package specifier — return as-is
    return source;
  }
}
