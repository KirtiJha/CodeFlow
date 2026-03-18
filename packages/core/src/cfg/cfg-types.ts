// ─── Control Flow Graph Types ─────────────────────────────────

export interface BasicBlock {
  id: string;
  functionId: string;
  kind: BlockKind;
  startLine?: number;
  endLine?: number;
  statements: StatementRef[];
}

export type BlockKind =
  | "entry"
  | "exit"
  | "normal"
  | "branch"
  | "loop_header"
  | "loop_body"
  | "catch"
  | "finally"
  | "switch_case"
  | "return"
  | "throw";

export interface StatementRef {
  nodeType: string;
  startLine: number;
  endLine: number;
  text: string;
}

export interface CFGEdge {
  id: string;
  sourceBlockId: string;
  targetBlockId: string;
  kind: CFGEdgeKind;
  condition?: string;
}

export type CFGEdgeKind =
  | "normal"
  | "true_branch"
  | "false_branch"
  | "back_edge"
  | "exception"
  | "break"
  | "continue"
  | "return"
  | "fallthrough"
  | "default"
  | "finally";

export interface ControlFlowGraph {
  functionId: string;
  entryBlockId: string;
  exitBlockId: string;
  blocks: Map<string, BasicBlock>;
  edges: CFGEdge[];
}
