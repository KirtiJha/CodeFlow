import type Parser from "tree-sitter";
import type {
  Language,
  ExtractedSymbol,
  ExtractedImport,
  ExtractedCall,
  ExtractedHeritage,
  ParseResult,
} from "../../graph/types.js";

/**
 * Abstract base class for language-specific symbol extractors.
 * Subclasses implement AST traversal using tree-sitter query captures.
 */
export abstract class BaseExtractor {
  abstract readonly language: Language;

  /**
   * Extract all symbols, imports, calls, and heritage from a parsed tree.
   */
  extract(tree: Parser.Tree, filePath: string): ParseResult {
    const root = tree.rootNode;
    return {
      filePath,
      language: this.language,
      symbols: this.extractSymbols(root, filePath),
      imports: this.extractImports(root, filePath),
      calls: this.extractCalls(root, filePath),
      heritage: this.extractHeritage(root, filePath),
    };
  }

  protected abstract extractSymbols(
    root: Parser.SyntaxNode,
    filePath: string,
  ): ExtractedSymbol[];
  protected abstract extractImports(
    root: Parser.SyntaxNode,
    filePath: string,
  ): ExtractedImport[];
  protected abstract extractCalls(
    root: Parser.SyntaxNode,
    filePath: string,
  ): ExtractedCall[];
  protected abstract extractHeritage(
    root: Parser.SyntaxNode,
    filePath: string,
  ): ExtractedHeritage[];

  // ─── Utilities ───

  protected nodeText(node: Parser.SyntaxNode | null): string {
    return node?.text ?? "";
  }

  protected nodeLocation(node: Parser.SyntaxNode) {
    return {
      start: {
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
      },
      end: { line: node.endPosition.row + 1, column: node.endPosition.column },
    };
  }

  protected countParams(paramsNode: Parser.SyntaxNode | null): number {
    if (!paramsNode) return 0;
    return paramsNode.namedChildren.filter(
      (c) =>
        c.type === "required_parameter" ||
        c.type === "optional_parameter" ||
        c.type === "formal_parameter" ||
        c.type === "identifier" ||
        c.type === "parameter" ||
        c.type === "rest_parameter",
    ).length;
  }

  /**
   * Walk the tree depth-first, collecting nodes that match a type.
   */
  protected collectByType(
    root: Parser.SyntaxNode,
    ...types: string[]
  ): Parser.SyntaxNode[] {
    const results: Parser.SyntaxNode[] = [];
    const typeSet = new Set(types);
    const stack: Parser.SyntaxNode[] = [root];

    while (stack.length > 0) {
      const node = stack.pop()!;
      if (typeSet.has(node.type)) {
        results.push(node);
      }
      for (let i = node.namedChildCount - 1; i >= 0; i--) {
        stack.push(node.namedChild(i)!);
      }
    }

    return results;
  }
}
