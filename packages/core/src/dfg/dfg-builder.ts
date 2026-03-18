import type Parser from "tree-sitter";
import { v4 as uuid } from "uuid";
import type { ControlFlowGraph } from "../cfg/cfg-types.js";
import type {
  DFGNode,
  DFGEdge,
  DataFlowGraph,
  DFGNodeKind,
} from "./dfg-types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("dfg:builder");

/**
 * Builds a Data Flow Graph from a CFG and AST.
 * Tracks how data flows through assignments, parameters, returns, and calls.
 */
export class DFGBuilder {
  private nodes = new Map<string, DFGNode>();
  private edges: DFGEdge[] = [];
  private sources: string[] = [];
  private sinks: string[] = [];
  private params: string[] = [];
  private returns: string[] = [];

  build(
    functionNode: Parser.SyntaxNode,
    cfg: ControlFlowGraph,
    functionId: string,
    repoId: string,
    filePath: string,
  ): DataFlowGraph {
    this.reset();

    // Extract parameter nodes
    const paramsNode = functionNode.childForFieldName("parameters");
    if (paramsNode) {
      this.extractParams(paramsNode, functionId, repoId, filePath);
    }

    // Walk the function body to build data dependencies
    const body = functionNode.childForFieldName("body");
    if (body) {
      this.walkBody(body, functionId, repoId, filePath);
    }

    return {
      functionId,
      nodes: new Map(this.nodes),
      edges: [...this.edges],
      sources: [...this.sources],
      sinks: [...this.sinks],
      params: [...this.params],
      returns: [...this.returns],
    };
  }

  private extractParams(
    paramsNode: Parser.SyntaxNode,
    functionId: string,
    repoId: string,
    filePath: string,
  ): void {
    for (const param of paramsNode.namedChildren) {
      const nameNode =
        param.childForFieldName("name") ??
        param.childForFieldName("pattern") ??
        (param.type === "identifier" ? param : null);

      if (nameNode) {
        const node = this.createNode({
          kind: "param",
          code: nameNode.text,
          functionId,
          repoId,
          filePath,
          line: nameNode.startPosition.row + 1,
          column: nameNode.startPosition.column,
        });
        this.params.push(node.id);
      }
    }
  }

  private walkBody(
    node: Parser.SyntaxNode,
    functionId: string,
    repoId: string,
    filePath: string,
  ): void {
    for (const child of node.namedChildren) {
      this.processNode(child, functionId, repoId, filePath);
    }
  }

  private processNode(
    node: Parser.SyntaxNode,
    functionId: string,
    repoId: string,
    filePath: string,
  ): string | null {
    switch (node.type) {
      case "lexical_declaration":
      case "variable_declaration":
      case "variable_declaration_statement":
        return this.processVarDecl(node, functionId, repoId, filePath);

      case "assignment_expression":
      case "augmented_assignment_expression":
      case "assignment_statement":
        return this.processAssignment(node, functionId, repoId, filePath);

      case "return_statement":
        return this.processReturn(node, functionId, repoId, filePath);

      case "call_expression":
      case "call":
        return this.processCall(node, functionId, repoId, filePath);

      case "member_expression":
      case "attribute":
      case "field_expression":
        return this.processFieldAccess(node, functionId, repoId, filePath);

      case "if_statement":
      case "for_statement":
      case "while_statement":
      case "try_statement":
        // Recurse into compound statements
        for (const child of node.namedChildren) {
          if (
            child.type.includes("block") ||
            child.type.includes("body") ||
            child.type.includes("clause") ||
            child.type.includes("statement")
          ) {
            this.walkBody(child, functionId, repoId, filePath);
          }
        }
        return null;

      default:
        // Recurse if this is a compound node
        if (node.namedChildCount > 0) {
          for (const child of node.namedChildren) {
            this.processNode(child, functionId, repoId, filePath);
          }
        }
        return null;
    }
  }

  private processVarDecl(
    node: Parser.SyntaxNode,
    functionId: string,
    repoId: string,
    filePath: string,
  ): string | null {
    for (const declarator of node.namedChildren) {
      if (declarator.type === "variable_declarator") {
        const name = declarator.childForFieldName("name");
        const value = declarator.childForFieldName("value");

        if (name) {
          const assignNode = this.createNode({
            kind: "assignment",
            code: name.text,
            functionId,
            repoId,
            filePath,
            line: name.startPosition.row + 1,
            column: name.startPosition.column,
          });

          // If there's an initializer, create a dependency
          if (value) {
            const valueNodeId = this.processNode(
              value,
              functionId,
              repoId,
              filePath,
            );
            if (valueNodeId) {
              this.addEdge(valueNodeId, assignNode.id, "data_dep", repoId);
            }
          }

          return assignNode.id;
        }
      }
    }
    return null;
  }

  private processAssignment(
    node: Parser.SyntaxNode,
    functionId: string,
    repoId: string,
    filePath: string,
  ): string | null {
    const left = node.childForFieldName("left");
    const right = node.childForFieldName("right");

    if (left) {
      const assignNode = this.createNode({
        kind: "assignment",
        code: left.text,
        functionId,
        repoId,
        filePath,
        line: left.startPosition.row + 1,
        column: left.startPosition.column,
      });

      if (right) {
        const rightNodeId = this.processNode(
          right,
          functionId,
          repoId,
          filePath,
        );
        if (rightNodeId) {
          this.addEdge(rightNodeId, assignNode.id, "data_dep", repoId);
        }
      }

      return assignNode.id;
    }
    return null;
  }

  private processReturn(
    node: Parser.SyntaxNode,
    functionId: string,
    repoId: string,
    filePath: string,
  ): string | null {
    const returnNode = this.createNode({
      kind: "return",
      code: node.text,
      functionId,
      repoId,
      filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
    });
    this.returns.push(returnNode.id);

    // Link the return value expression
    const value = node.namedChildren[0];
    if (value) {
      const valueNodeId = this.processNode(value, functionId, repoId, filePath);
      if (valueNodeId) {
        this.addEdge(valueNodeId, returnNode.id, "data_dep", repoId);
      }
    }

    return returnNode.id;
  }

  private processCall(
    node: Parser.SyntaxNode,
    functionId: string,
    repoId: string,
    filePath: string,
  ): string | null {
    const callNode = this.createNode({
      kind: "call_result",
      code:
        node.text.length > 100 ? node.text.slice(0, 100) + "..." : node.text,
      functionId,
      repoId,
      filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
    });

    // Process arguments — each arg flows into the call
    const argsNode = node.childForFieldName("arguments");
    if (argsNode) {
      for (const arg of argsNode.namedChildren) {
        const argNodeId = this.processNode(arg, functionId, repoId, filePath);
        if (argNodeId) {
          this.addEdge(argNodeId, callNode.id, "param_bind", repoId);
        }
      }
    }

    return callNode.id;
  }

  private processFieldAccess(
    node: Parser.SyntaxNode,
    functionId: string,
    repoId: string,
    filePath: string,
  ): string | null {
    const fieldNode = this.createNode({
      kind: "field_read",
      code: node.text,
      functionId,
      repoId,
      filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
    });

    // Link the object being accessed
    const obj =
      node.childForFieldName("object") ?? node.childForFieldName("argument");
    if (obj) {
      const objNodeId = this.processNode(obj, functionId, repoId, filePath);
      if (objNodeId) {
        this.addEdge(objNodeId, fieldNode.id, "field_flow", repoId);
      }
    }

    return fieldNode.id;
  }

  // ─── Helpers ───

  private createNode(opts: {
    kind: DFGNodeKind;
    code: string;
    functionId: string;
    repoId: string;
    filePath: string;
    line: number;
    column: number;
  }): DFGNode {
    const node: DFGNode = {
      id: uuid(),
      repoId: opts.repoId,
      functionId: opts.functionId,
      kind: opts.kind,
      code: opts.code,
      filePath: opts.filePath,
      line: opts.line,
      column: opts.column,
      isSource: false,
      isSink: false,
      isSanitizer: false,
    };
    this.nodes.set(node.id, node);
    return node;
  }

  private addEdge(
    sourceId: string,
    targetId: string,
    kind: DFGEdge["kind"],
    repoId: string,
  ): void {
    this.edges.push({
      id: uuid(),
      repoId,
      sourceId,
      targetId,
      kind,
      isSanitizing: false,
    });
  }

  private reset(): void {
    this.nodes.clear();
    this.edges = [];
    this.sources = [];
    this.sinks = [];
    this.params = [];
    this.returns = [];
  }
}
