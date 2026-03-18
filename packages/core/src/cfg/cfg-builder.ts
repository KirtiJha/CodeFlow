import type Parser from "tree-sitter";
import { v4 as uuid } from "uuid";
import type {
  BasicBlock,
  CFGEdge,
  ControlFlowGraph,
  BlockKind,
  CFGEdgeKind,
  StatementRef,
} from "./cfg-types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("cfg:builder");

/**
 * Builds a Control Flow Graph from a function's AST.
 * Works with any language by processing common statement patterns.
 */
export class CFGBuilder {
  private blocks = new Map<string, BasicBlock>();
  private edges: CFGEdge[] = [];
  private entryBlockId = "";
  private exitBlockId = "";
  private functionId = "";
  private currentBlockId = "";

  /**
   * Build a CFG for a function node.
   */
  build(functionNode: Parser.SyntaxNode, functionId: string): ControlFlowGraph {
    this.reset();
    this.functionId = functionId;

    // Create entry and exit blocks
    const entry = this.createBlock("entry");
    const exit = this.createBlock("exit");
    this.entryBlockId = entry.id;
    this.exitBlockId = exit.id;
    this.currentBlockId = entry.id;

    // Find the body of the function
    const body = functionNode.childForFieldName("body");
    if (body) {
      this.processBlock(body);
    }

    // Connect last block to exit if not already connected
    if (this.currentBlockId !== this.exitBlockId) {
      this.addEdge(this.currentBlockId, this.exitBlockId, "normal");
    }

    return {
      functionId,
      entryBlockId: this.entryBlockId,
      exitBlockId: this.exitBlockId,
      blocks: new Map(this.blocks),
      edges: [...this.edges],
    };
  }

  private processBlock(node: Parser.SyntaxNode): void {
    for (const child of node.namedChildren) {
      this.processStatement(child);
    }
  }

  private processStatement(node: Parser.SyntaxNode): void {
    switch (node.type) {
      case "if_statement":
        this.processIf(node);
        break;
      case "for_statement":
      case "for_in_statement":
      case "while_statement":
      case "do_statement":
      case "for_range_clause":
        this.processLoop(node);
        break;
      case "switch_statement":
      case "switch_expression":
        this.processSwitch(node);
        break;
      case "try_statement":
        this.processTryCatch(node);
        break;
      case "return_statement":
        this.addStatementToCurrentBlock(node);
        this.addEdge(this.currentBlockId, this.exitBlockId, "normal");
        // Subsequent code is unreachable
        this.currentBlockId = this.createBlock("normal").id;
        break;
      case "throw_statement":
      case "raise_statement":
        this.addStatementToCurrentBlock(node);
        this.addEdge(this.currentBlockId, this.exitBlockId, "exception");
        this.currentBlockId = this.createBlock("normal").id;
        break;
      case "break_statement":
      case "continue_statement":
        this.addStatementToCurrentBlock(node);
        // These are handled by loop context
        break;
      default:
        this.addStatementToCurrentBlock(node);
        break;
    }
  }

  private processIf(node: Parser.SyntaxNode): void {
    const condition = node.childForFieldName("condition");
    this.addStatementToCurrentBlock(condition ?? node);

    const branchBlock = this.blocks.get(this.currentBlockId)!;
    branchBlock.kind = "branch";

    const thenBlock = this.createBlock("normal");
    const mergeBlock = this.createBlock("normal");

    // true branch
    this.addEdge(this.currentBlockId, thenBlock.id, "true_branch");
    this.currentBlockId = thenBlock.id;

    const consequence = node.childForFieldName("consequence");
    if (consequence) this.processBlock(consequence);
    this.addEdge(this.currentBlockId, mergeBlock.id, "normal");

    // false branch
    const alternative = node.childForFieldName("alternative");
    if (alternative) {
      const elseBlock = this.createBlock("normal");
      this.addEdge(branchBlock.id, elseBlock.id, "false_branch");
      this.currentBlockId = elseBlock.id;
      this.processBlock(alternative);
      this.addEdge(this.currentBlockId, mergeBlock.id, "normal");
    } else {
      this.addEdge(branchBlock.id, mergeBlock.id, "false_branch");
    }

    this.currentBlockId = mergeBlock.id;
  }

  private processLoop(node: Parser.SyntaxNode): void {
    const headerBlock = this.createBlock("loop_header");
    this.addEdge(this.currentBlockId, headerBlock.id, "normal");

    const bodyBlock = this.createBlock("normal");
    const exitBlock = this.createBlock("normal");

    // Header → body (true) or exit (false)
    this.addEdge(headerBlock.id, bodyBlock.id, "true_branch");
    this.addEdge(headerBlock.id, exitBlock.id, "false_branch");

    // Process loop body
    this.currentBlockId = bodyBlock.id;
    const body = node.childForFieldName("body");
    if (body) this.processBlock(body);

    // Back edge: body end → header
    this.addEdge(this.currentBlockId, headerBlock.id, "back_edge");

    this.currentBlockId = exitBlock.id;
  }

  private processSwitch(node: Parser.SyntaxNode): void {
    this.addStatementToCurrentBlock(node.childForFieldName("value") ?? node);
    const switchBlockId = this.currentBlockId;
    const mergeBlock = this.createBlock("normal");

    const body = node.childForFieldName("body");
    if (body) {
      for (const caseNode of body.namedChildren) {
        if (
          caseNode.type === "switch_case" ||
          caseNode.type === "switch_default"
        ) {
          const caseBlock = this.createBlock("normal");
          this.addEdge(switchBlockId, caseBlock.id, "normal");
          this.currentBlockId = caseBlock.id;

          for (const stmt of caseNode.namedChildren) {
            this.processStatement(stmt);
          }

          this.addEdge(this.currentBlockId, mergeBlock.id, "normal");
        }
      }
    }

    this.currentBlockId = mergeBlock.id;
  }

  private processTryCatch(node: Parser.SyntaxNode): void {
    const tryBlock = this.createBlock("normal");
    this.addEdge(this.currentBlockId, tryBlock.id, "normal");
    this.currentBlockId = tryBlock.id;

    const mergeBlock = this.createBlock("normal");

    // Try body
    const tryBody = node.childForFieldName("body");
    if (tryBody) this.processBlock(tryBody);
    this.addEdge(this.currentBlockId, mergeBlock.id, "normal");

    // Catch handlers
    for (const child of node.namedChildren) {
      if (child.type === "catch_clause" || child.type === "except_clause") {
        const catchBlock = this.createBlock("catch");
        this.addEdge(tryBlock.id, catchBlock.id, "exception");
        this.currentBlockId = catchBlock.id;

        const catchBody = child.childForFieldName("body");
        if (catchBody) this.processBlock(catchBody);
        this.addEdge(this.currentBlockId, mergeBlock.id, "normal");
      }
    }

    // Finally block
    for (const child of node.namedChildren) {
      if (child.type === "finally_clause") {
        const finallyBlock = this.createBlock("finally");
        this.addEdge(tryBlock.id, finallyBlock.id, "normal");
        this.currentBlockId = finallyBlock.id;

        const finallyBody = child.childForFieldName("body");
        if (finallyBody) this.processBlock(finallyBody);
        this.addEdge(this.currentBlockId, mergeBlock.id, "normal");
      }
    }

    this.currentBlockId = mergeBlock.id;
  }

  // ─── Helpers ───

  private createBlock(kind: BlockKind): BasicBlock {
    const block: BasicBlock = {
      id: uuid(),
      functionId: this.functionId,
      kind,
      statements: [],
    };
    this.blocks.set(block.id, block);
    return block;
  }

  private addEdge(
    sourceId: string,
    targetId: string,
    kind: CFGEdgeKind,
    condition?: string,
  ): void {
    this.edges.push({
      id: uuid(),
      sourceBlockId: sourceId,
      targetBlockId: targetId,
      kind,
      condition,
    });
  }

  private addStatementToCurrentBlock(node: Parser.SyntaxNode | null): void {
    if (!node) return;
    const block = this.blocks.get(this.currentBlockId);
    if (block) {
      const ref: StatementRef = {
        nodeType: node.type,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        text:
          node.text.length > 200 ? node.text.slice(0, 200) + "..." : node.text,
      };
      block.statements.push(ref);
    }
  }

  private reset(): void {
    this.blocks.clear();
    this.edges = [];
    this.entryBlockId = "";
    this.exitBlockId = "";
    this.functionId = "";
    this.currentBlockId = "";
  }
}
