import type { SymbolTable } from "./symbol-table.js";

/**
 * Resolves re-export chains (e.g., barrel files that re-export from submodules).
 */
export class ExportResolver {
  private readonly reExportMap = new Map<string, string[]>();

  constructor(private readonly symbolTable: SymbolTable) {}

  /**
   * Register a re-export: "file A re-exports names from file B"
   */
  registerReExport(fromFile: string, targetFile: string): void {
    const existing = this.reExportMap.get(fromFile) ?? [];
    if (!existing.includes(targetFile)) {
      existing.push(targetFile);
      this.reExportMap.set(fromFile, existing);
    }
  }

  /**
   * Follow re-export chain to find the original definition file.
   * Prevents infinite loops with a max depth.
   */
  resolveExportChain(
    name: string,
    startFile: string,
    maxDepth = 5,
  ): string | null {
    const visited = new Set<string>();
    const queue = [startFile];
    let depth = 0;

    while (queue.length > 0 && depth < maxDepth) {
      const file = queue.shift()!;
      if (visited.has(file)) continue;
      visited.add(file);

      // Check if the name is defined (not re-exported) in this file
      const symbols = this.symbolTable.getByFile(file);
      const found = symbols.find((s) => s.name === name);
      if (found) return found.qualifiedName;

      // Follow re-exports
      const reExports = this.reExportMap.get(file) ?? [];
      for (const target of reExports) {
        queue.push(target);
      }
      depth++;
    }

    return null;
  }

  clear(): void {
    this.reExportMap.clear();
  }
}
