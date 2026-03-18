export { DFGBuilder } from "./dfg-builder.js";
export { SSATransform } from "./ssa-transform.js";
export type { SSAResult } from "./ssa-transform.js";
export { ReachingDefinitions } from "./reaching-defs.js";
export { UseDefChains } from "./use-def-chains.js";
export type { UseDefChain, DefUseChain } from "./use-def-chains.js";
export { InterproceduralDFG } from "./interprocedural.js";
export type { TraceStep, TracePath } from "./interprocedural.js";
export type {
  DFGNode,
  DFGNodeKind,
  DFGEdge,
  DFGEdgeKind,
  DataFlowGraph,
  SourceKind,
  SinkKind,
  SSAVariable,
  PhiNode,
  ReachingDef,
} from "./dfg-types.js";
