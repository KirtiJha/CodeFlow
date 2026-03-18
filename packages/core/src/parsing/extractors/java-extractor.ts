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

export class JavaExtractor extends BaseExtractor {
  readonly language: Language = "java";

  protected extractSymbols(
    root: Parser.SyntaxNode,
    filePath: string,
  ): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    // Classes
    for (const node of this.collectByType(root, "class_declaration")) {
      const name = node.childForFieldName("name");
      if (name) {
        symbols.push({
          name: this.nodeText(name),
          kind: "class" as NodeKind,
          filePath,
          location: this.nodeLocation(node),
          isExported: this.hasModifier(node, "public"),
        });
      }
    }

    // Interfaces
    for (const node of this.collectByType(root, "interface_declaration")) {
      const name = node.childForFieldName("name");
      if (name) {
        symbols.push({
          name: this.nodeText(name),
          kind: "interface" as NodeKind,
          filePath,
          location: this.nodeLocation(node),
          isExported: this.hasModifier(node, "public"),
        });
      }
    }

    // Methods
    for (const node of this.collectByType(root, "method_declaration")) {
      const name = node.childForFieldName("name");
      const params = node.childForFieldName("parameters");
      const returnType = node.childForFieldName("type");
      const ownerClass = this.findOwnerClass(node);

      if (name) {
        symbols.push({
          name: this.nodeText(name),
          kind: "method" as NodeKind,
          filePath,
          location: this.nodeLocation(node),
          owner: ownerClass || undefined,
          signature: `${this.nodeText(returnType)} ${this.nodeText(name)}${this.nodeText(params)}`,
          paramCount: this.countParams(params),
          returnType: this.nodeText(returnType) || undefined,
        });
      }
    }

    // Constructors
    for (const node of this.collectByType(root, "constructor_declaration")) {
      const name = node.childForFieldName("name");
      const params = node.childForFieldName("parameters");

      if (name) {
        symbols.push({
          name: this.nodeText(name),
          kind: "constructor" as NodeKind,
          filePath,
          location: this.nodeLocation(node),
          owner: this.findOwnerClass(node) || undefined,
          paramCount: this.countParams(params),
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
      const pathNode = node.namedChildren[0];
      if (pathNode) {
        const fullPath = this.nodeText(pathNode);
        const parts = fullPath.split(".");
        const name = parts[parts.length - 1] ?? fullPath;
        imports.push({
          source: fullPath,
          specifiers: [{ name }],
          location: this.nodeLocation(node),
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

    for (const node of this.collectByType(root, "method_invocation")) {
      const name = node.childForFieldName("name");
      const obj = node.childForFieldName("object");
      const args = node.childForFieldName("arguments");
      const argCount = args ? args.namedChildren.length : 0;

      if (name) {
        calls.push({
          callee: this.nodeText(name),
          receiver: obj ? this.nodeText(obj) : undefined,
          argCount,
          location: this.nodeLocation(node),
          filePath,
        });
      }
    }

    for (const node of this.collectByType(root, "object_creation_expression")) {
      const typeNode = node.childForFieldName("type");
      const args = node.childForFieldName("arguments");
      const argCount = args ? args.namedChildren.length : 0;

      if (typeNode) {
        calls.push({
          callee: this.nodeText(typeNode),
          argCount,
          location: this.nodeLocation(node),
          filePath,
          isConstructor: true,
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

    for (const classNode of this.collectByType(root, "class_declaration")) {
      const className = this.nodeText(classNode.childForFieldName("name"));
      const superclass = classNode.childForFieldName("superclass");
      const interfaces = classNode.childForFieldName("interfaces");

      if (superclass) {
        heritage.push({
          childName: className,
          parentName: this.nodeText(superclass).replace("extends ", ""),
          kind: "extends",
          filePath,
          location: this.nodeLocation(classNode),
        });
      }

      if (interfaces) {
        for (const impl of interfaces.namedChildren) {
          heritage.push({
            childName: className,
            parentName: this.nodeText(impl),
            kind: "implements",
            filePath,
            location: this.nodeLocation(classNode),
          });
        }
      }
    }

    return heritage;
  }

  private findOwnerClass(node: Parser.SyntaxNode): string | null {
    let current = node.parent;
    while (current) {
      if (
        current.type === "class_declaration" ||
        current.type === "interface_declaration"
      ) {
        const name = current.childForFieldName("name");
        return name ? this.nodeText(name) : null;
      }
      current = current.parent;
    }
    return null;
  }

  private hasModifier(node: Parser.SyntaxNode, modifier: string): boolean {
    const modifiers = node.children.find((c) => c.type === "modifiers");
    return modifiers?.text.includes(modifier) ?? false;
  }
}
