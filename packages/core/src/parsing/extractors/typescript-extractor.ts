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

export class TypeScriptExtractor extends BaseExtractor {
  readonly language: Language = "typescript";

  protected extractSymbols(
    root: Parser.SyntaxNode,
    filePath: string,
  ): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    // Functions
    for (const node of this.collectByType(root, "function_declaration")) {
      const name = node.childForFieldName("name");
      const params = node.childForFieldName("parameters");
      const returnType = node.childForFieldName("return_type");
      if (name) {
        symbols.push({
          name: this.nodeText(name),
          kind: "function" as NodeKind,
          filePath,
          location: this.nodeLocation(node),
          signature: this.buildSignature(name, params, returnType),
          paramCount: this.countParams(params),
          returnType:
            this.nodeText(returnType)?.replace(/^:\s*/, "") || undefined,
          isExported: this.isExported(node),
        });
      }
    }

    // Arrow functions in variable declarations
    for (const node of this.collectByType(
      root,
      "lexical_declaration",
      "variable_declaration",
    )) {
      for (const declarator of this.collectByType(
        node,
        "variable_declarator",
      )) {
        const nameNode = declarator.childForFieldName("name");
        const valueNode = declarator.childForFieldName("value");
        if (nameNode && valueNode?.type === "arrow_function") {
          const params = valueNode.childForFieldName("parameters");
          const returnType = valueNode.childForFieldName("return_type");
          symbols.push({
            name: this.nodeText(nameNode),
            kind: "function" as NodeKind,
            filePath,
            location: this.nodeLocation(node),
            signature: this.buildSignature(nameNode, params, returnType),
            paramCount: this.countParams(params),
            returnType:
              this.nodeText(returnType)?.replace(/^:\s*/, "") || undefined,
            isExported: this.isExported(node),
          });
        }
      }
    }

    // Classes
    for (const node of this.collectByType(root, "class_declaration")) {
      const name = node.childForFieldName("name");
      if (name) {
        symbols.push({
          name: this.nodeText(name),
          kind: "class" as NodeKind,
          filePath,
          location: this.nodeLocation(node),
          isExported: this.isExported(node),
        });

        const body = node.childForFieldName("body");
        if (body) {
          // Methods within the class
          for (const method of this.collectByType(body, "method_definition")) {
            const methodName = method.childForFieldName("name");
            const params = method.childForFieldName("parameters");
            const returnType = method.childForFieldName("return_type");
            if (methodName) {
              symbols.push({
                name: this.nodeText(methodName),
                kind: "method" as NodeKind,
                filePath,
                location: this.nodeLocation(method),
                owner: this.nodeText(name),
                parentName: this.nodeText(name),
                signature: this.buildSignature(methodName, params, returnType),
                paramCount: this.countParams(params),
                returnType:
                  this.nodeText(returnType)?.replace(/^:\s*/, "") || undefined,
              });
            }
          }

          // Properties within the class
          for (const prop of this.collectByType(
            body,
            "public_field_definition",
          )) {
            const propName = prop.childForFieldName("name");
            const typeAnnotation = prop.childForFieldName("type");
            if (propName) {
              symbols.push({
                name: this.nodeText(propName),
                kind: "property" as NodeKind,
                filePath,
                location: this.nodeLocation(prop),
                owner: this.nodeText(name),
                parentName: this.nodeText(name),
                typeAnnotation:
                  this.nodeText(typeAnnotation)?.replace(/^:\s*/, "") ||
                  undefined,
              });
            }
          }
        }
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
          isExported: this.isExported(node),
        });

        // Interface property signatures (fields)
        const body = node.childForFieldName("body");
        if (body) {
          for (const prop of this.collectByType(body, "property_signature")) {
            const propName = prop.childForFieldName("name");
            const typeAnnotation = prop.childForFieldName("type");
            if (propName) {
              symbols.push({
                name: this.nodeText(propName),
                kind: "property" as NodeKind,
                filePath,
                location: this.nodeLocation(prop),
                owner: this.nodeText(name),
                parentName: this.nodeText(name),
                typeAnnotation:
                  this.nodeText(typeAnnotation)?.replace(/^:\s*/, "") ||
                  undefined,
              });
            }
          }

          // Interface method signatures
          for (const method of this.collectByType(body, "method_signature")) {
            const methodName = method.childForFieldName("name");
            const params = method.childForFieldName("parameters");
            const returnType = method.childForFieldName("return_type");
            if (methodName) {
              symbols.push({
                name: this.nodeText(methodName),
                kind: "method" as NodeKind,
                filePath,
                location: this.nodeLocation(method),
                owner: this.nodeText(name),
                parentName: this.nodeText(name),
                signature: this.buildSignature(methodName, params, returnType),
                paramCount: this.countParams(params),
                returnType:
                  this.nodeText(returnType)?.replace(/^:\s*/, "") || undefined,
              });
            }
          }
        }
      }
    }

    // Type aliases
    for (const node of this.collectByType(root, "type_alias_declaration")) {
      const name = node.childForFieldName("name");
      if (name) {
        symbols.push({
          name: this.nodeText(name),
          kind: "type_alias" as NodeKind,
          filePath,
          location: this.nodeLocation(node),
          isExported: this.isExported(node),
        });
      }
    }

    // Enums
    for (const node of this.collectByType(root, "enum_declaration")) {
      const name = node.childForFieldName("name");
      if (name) {
        symbols.push({
          name: this.nodeText(name),
          kind: "enum" as NodeKind,
          filePath,
          location: this.nodeLocation(node),
          isExported: this.isExported(node),
        });

        // Enum members
        const body = node.childForFieldName("body");
        if (body) {
          for (const member of this.collectByType(body, "enum_assignment")) {
            const memberName = member.childForFieldName("name");
            const memberValue = member.childForFieldName("value");
            if (memberName) {
              symbols.push({
                name: this.nodeText(memberName),
                kind: "property" as NodeKind,
                filePath,
                location: this.nodeLocation(member),
                owner: this.nodeText(name),
                parentName: this.nodeText(name),
                typeAnnotation: memberValue
                  ? this.nodeText(memberValue)
                  : undefined,
              });
            }
          }
        }
      }
    }

    return symbols;
  }

  protected extractImports(
    root: Parser.SyntaxNode,
    _filePath: string,
  ): ExtractedImport[] {
    const imports: ExtractedImport[] = [];

    for (const node of this.collectByType(root, "import_statement")) {
      const source = node.childForFieldName("source");
      const sourceText = this.nodeText(source).replace(/['"]/g, "");
      const clause = node.children.find((c) => c.type === "import_clause");

      if (!clause) continue;

      // Default import
      const defaultImport = clause.children.find(
        (c) => c.type === "identifier",
      );
      if (defaultImport) {
        imports.push({
          source: sourceText,
          specifiers: [
            { name: "default", alias: this.nodeText(defaultImport) },
          ],
          location: this.nodeLocation(node),
          isTypeOnly: node.text.includes("import type"),
        });
      }

      // Named imports
      const namedImports = clause.children.find(
        (c) => c.type === "named_imports",
      );
      if (namedImports) {
        const specifiers = this.collectByType(
          namedImports,
          "import_specifier",
        ).map((spec) => {
          const name = spec.childForFieldName("name");
          const alias = spec.childForFieldName("alias");
          return {
            name: this.nodeText(name),
            alias: alias ? this.nodeText(alias) : undefined,
          };
        });
        if (specifiers.length > 0) {
          imports.push({
            source: sourceText,
            specifiers,
            location: this.nodeLocation(node),
            isTypeOnly: node.text.includes("import type"),
          });
        }
      }

      // Namespace import
      const nsImport = clause.children.find(
        (c) => c.type === "namespace_import",
      );
      if (nsImport) {
        const name =
          nsImport.children.find((c) => c.type === "identifier") ?? null;
        imports.push({
          source: sourceText,
          specifiers: [{ name: "*", alias: this.nodeText(name) }],
          location: this.nodeLocation(node),
          isTypeOnly: node.text.includes("import type"),
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

    for (const node of this.collectByType(
      root,
      "call_expression",
      "new_expression",
    )) {
      const fn =
        node.childForFieldName("function") ??
        node.childForFieldName("constructor");
      const args = node.childForFieldName("arguments");
      const argCount = args ? args.namedChildren.length : 0;

      if (fn?.type === "member_expression") {
        const receiver = fn.childForFieldName("object");
        const property = fn.childForFieldName("property");
        calls.push({
          callee: this.nodeText(property),
          receiver: this.nodeText(receiver),
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
          isConstructor: node.type === "new_expression",
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
      const heritageClause = classNode.children.find(
        (c) => c.type === "class_heritage",
      );

      if (heritageClause) {
        // extends
        const extendsClause = heritageClause.children.find(
          (c) => c.type === "extends_clause",
        );
        if (extendsClause) {
          const target = extendsClause.namedChildren[0];
          if (target) {
            heritage.push({
              childName: className,
              parentName: this.nodeText(target),
              kind: "extends",
              filePath,
              location: this.nodeLocation(classNode),
            });
          }
        }

        // implements
        const implementsClause = heritageClause.children.find(
          (c) => c.type === "implements_clause",
        );
        if (implementsClause) {
          for (const impl of implementsClause.namedChildren) {
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
    }

    return heritage;
  }

  // ─── Helpers ───

  private isExported(node: Parser.SyntaxNode): boolean {
    return node.parent?.type === "export_statement" || false;
  }

  private buildSignature(
    name: Parser.SyntaxNode | null,
    params: Parser.SyntaxNode | null,
    returnType: Parser.SyntaxNode | null,
  ): string {
    let sig = this.nodeText(name);
    sig += this.nodeText(params) || "()";
    if (returnType) {
      sig += `: ${this.nodeText(returnType).replace(/^:\s*/, "")}`;
    }
    return sig;
  }
}
