import type Parser from "tree-sitter";
import { BaseExtractor } from "./base-extractor.js";
import type {
  Language,
  ExtractedSymbol,
  ExtractedImport,
  ExtractedCall,
  ExtractedHeritage,
  NodeKind,
} from "../../graph/types.js";

export class GoExtractor extends BaseExtractor {
  readonly language: Language = "go";

  protected extractSymbols(
    root: Parser.SyntaxNode,
    filePath: string,
  ): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    // Functions
    for (const node of this.collectByType(root, "function_declaration")) {
      const name = node.childForFieldName("name");
      const params = node.childForFieldName("parameters");
      const result = node.childForFieldName("result");

      if (name) {
        const nameStr = this.nodeText(name);
        symbols.push({
          name: nameStr,
          kind: "function" as NodeKind,
          filePath,
          location: this.nodeLocation(node),
          signature: `func ${nameStr}${this.nodeText(params)}`,
          paramCount: this.countGoParams(params),
          returnType: this.nodeText(result) || undefined,
          isExported: (nameStr[0] ?? "") === (nameStr[0] ?? "").toUpperCase(),
        });
      }
    }

    // Methods (functions with receivers)
    for (const node of this.collectByType(root, "method_declaration")) {
      const name = node.childForFieldName("name");
      const receiver = node.childForFieldName("receiver");
      const params = node.childForFieldName("parameters");
      const result = node.childForFieldName("result");

      if (name) {
        const nameStr = this.nodeText(name);
        const receiverType = this.extractGoReceiverType(receiver);
        symbols.push({
          name: nameStr,
          kind: "method" as NodeKind,
          filePath,
          location: this.nodeLocation(node),
          owner: receiverType || undefined,
          signature: `func (${this.nodeText(receiver)}) ${nameStr}${this.nodeText(params)}`,
          paramCount: this.countGoParams(params),
          returnType: this.nodeText(result) || undefined,
          isExported: (nameStr[0] ?? "") === (nameStr[0] ?? "").toUpperCase(),
        });
      }
    }

    // Structs
    for (const node of this.collectByType(root, "type_declaration")) {
      const spec = node.namedChildren.find((c) => c.type === "type_spec");
      if (!spec) continue;
      const name = spec.childForFieldName("name");
      const typeNode = spec.childForFieldName("type");

      if (name && typeNode?.type === "struct_type") {
        symbols.push({
          name: this.nodeText(name),
          kind: "struct" as NodeKind,
          filePath,
          location: this.nodeLocation(node),
          isExported:
            (this.nodeText(name)[0] ?? "") ===
            (this.nodeText(name)[0] ?? "").toUpperCase(),
        });
      } else if (name && typeNode?.type === "interface_type") {
        symbols.push({
          name: this.nodeText(name),
          kind: "interface" as NodeKind,
          filePath,
          location: this.nodeLocation(node),
          isExported:
            (this.nodeText(name)[0] ?? "") ===
            (this.nodeText(name)[0] ?? "").toUpperCase(),
        });
      }
    }

    return symbols;
  }

  protected extractImports(
    root: Parser.SyntaxNode,
    _filePath: string,
  ): ExtractedImport[] {
    const imports: ExtractedImport[] = [];

    for (const node of this.collectByType(root, "import_declaration")) {
      const specs = this.collectByType(node, "import_spec");
      for (const spec of specs) {
        const pathNode = spec.childForFieldName("path");
        const aliasNode = spec.childForFieldName("name");
        const source = this.nodeText(pathNode).replace(/"/g, "");
        const packageName = source.split("/").pop() ?? source;

        imports.push({
          source,
          specifiers: [
            {
              name: packageName,
              alias: aliasNode ? this.nodeText(aliasNode) : undefined,
            },
          ],
          location: this.nodeLocation(spec),
        });
      }
    }

    return imports;
  }

  protected extractCalls(
    root: Parser.SyntaxNode,
    filePath: string,
  ): ExtractedCall[] {
    const calls: ExtractedCall[] = [];

    for (const node of this.collectByType(root, "call_expression")) {
      const fn = node.childForFieldName("function");
      const args = node.childForFieldName("arguments");
      const argCount = args ? args.namedChildren.length : 0;

      if (fn?.type === "selector_expression") {
        const operand = fn.childForFieldName("operand");
        const field = fn.childForFieldName("field");
        calls.push({
          callee: this.nodeText(field),
          receiver: this.nodeText(operand),
          argCount,
          location: this.nodeLocation(node),
          filePath,
        });
      } else if (fn?.type === "identifier") {
        calls.push({
          callee: this.nodeText(fn),
          argCount,
          location: this.nodeLocation(node),
          filePath,
        });
      }
    }

    return calls;
  }

  protected extractHeritage(
    _root: Parser.SyntaxNode,
    _filePath: string,
  ): ExtractedHeritage[] {
    // Go uses composition via embedding, not inheritance
    return [];
  }

  private countGoParams(paramsNode: Parser.SyntaxNode | null): number {
    if (!paramsNode) return 0;
    return paramsNode.namedChildren.filter(
      (c) => c.type === "parameter_declaration",
    ).length;
  }

  private extractGoReceiverType(
    receiver: Parser.SyntaxNode | null,
  ): string | null {
    if (!receiver) return null;
    const paramDecl = receiver.namedChildren.find(
      (c) => c.type === "parameter_declaration",
    );
    if (!paramDecl) return null;
    const typeNode = paramDecl.childForFieldName("type");
    if (!typeNode) return null;
    // Strip pointer indicator
    return this.nodeText(typeNode).replace(/^\*/, "");
  }
}
