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

export class PythonExtractor extends BaseExtractor {
  readonly language: Language = "python";

  protected extractSymbols(
    root: Parser.SyntaxNode,
    filePath: string,
  ): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    // Functions (including decorated)
    for (const node of this.collectByType(root, "function_definition")) {
      const name = node.childForFieldName("name");
      const params = node.childForFieldName("parameters");
      const returnType = node.childForFieldName("return_type");
      const ownerClass = this.findOwnerClass(node);

      if (name) {
        symbols.push({
          name: this.nodeText(name),
          kind: (ownerClass ? "method" : "function") as NodeKind,
          filePath,
          location: this.nodeLocation(node),
          owner: ownerClass || undefined,
          signature: `${this.nodeText(name)}${this.nodeText(params)}`,
          paramCount: this.countPythonParams(params),
          returnType: this.nodeText(returnType) || undefined,
        });
      }
    }

    // Classes
    for (const node of this.collectByType(root, "class_definition")) {
      const name = node.childForFieldName("name");
      if (name) {
        symbols.push({
          name: this.nodeText(name),
          kind: "class" as NodeKind,
          filePath,
          location: this.nodeLocation(node),
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

    // import X
    for (const node of this.collectByType(root, "import_statement")) {
      const nameNode = node.children.find((c) => c.type === "dotted_name");
      if (nameNode) {
        imports.push({
          source: this.nodeText(nameNode),
          specifiers: [{ name: this.nodeText(nameNode) }],
          location: this.nodeLocation(node),
        });
      }
    }

    // from X import Y
    for (const node of this.collectByType(root, "import_from_statement")) {
      const moduleNode = node.childForFieldName("module_name");
      const source = this.nodeText(moduleNode);

      const specifiers: ExtractedImport["specifiers"] = [];
      for (const child of node.namedChildren) {
        if (child.type === "dotted_name" && child !== moduleNode) {
          specifiers.push({ name: this.nodeText(child) });
        }
        if (child.type === "aliased_import") {
          const name = child.childForFieldName("name");
          const alias = child.childForFieldName("alias");
          specifiers.push({
            name: this.nodeText(name),
            alias: alias ? this.nodeText(alias) : undefined,
          });
        }
      }

      if (specifiers.length > 0) {
        imports.push({ source, specifiers, location: this.nodeLocation(node) });
      }
    }

    return imports;
  }

  protected extractCalls(
    root: Parser.SyntaxNode,
    filePath: string,
  ): ExtractedCall[] {
    const calls: ExtractedCall[] = [];

    for (const node of this.collectByType(root, "call")) {
      const fn = node.childForFieldName("function");
      const args = node.childForFieldName("arguments");
      const argCount = args ? args.namedChildren.length : 0;

      if (fn?.type === "attribute") {
        const obj = fn.childForFieldName("object");
        const attr = fn.childForFieldName("attribute");
        calls.push({
          callee: this.nodeText(attr),
          receiver: this.nodeText(obj),
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
    root: Parser.SyntaxNode,
    filePath: string,
  ): ExtractedHeritage[] {
    const heritage: ExtractedHeritage[] = [];

    for (const classNode of this.collectByType(root, "class_definition")) {
      const className = this.nodeText(classNode.childForFieldName("name"));
      const superclasses = classNode.childForFieldName("superclasses");

      if (superclasses) {
        for (const arg of superclasses.namedChildren) {
          const parentName = this.nodeText(arg);
          if (parentName && parentName !== "object") {
            heritage.push({
              childName: className,
              parentName,
              kind: "extends",
              filePath,
              location: this.nodeLocation(classNode),
            });
          }
        }
      }
    }

    return heritage;
  }

  private findOwnerClass(node: Parser.SyntaxNode): string | null {
    let current = node.parent;
    while (current) {
      if (current.type === "class_definition") {
        const name = current.childForFieldName("name");
        return name ? this.nodeText(name) : null;
      }
      current = current.parent;
    }
    return null;
  }

  private countPythonParams(paramsNode: Parser.SyntaxNode | null): number {
    if (!paramsNode) return 0;
    return paramsNode.namedChildren.filter(
      (c) =>
        c.type === "identifier" ||
        c.type === "typed_parameter" ||
        c.type === "default_parameter" ||
        c.type === "typed_default_parameter" ||
        c.type === "list_splat_pattern" ||
        c.type === "dictionary_splat_pattern",
    ).length;
  }
}
