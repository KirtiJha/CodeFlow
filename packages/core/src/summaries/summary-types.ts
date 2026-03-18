// ─── Function Summary Types ───────────────────────────────────

export interface FunctionSummary {
  id: string;
  nodeId: string;
  name: string;
  filePath: string;

  paramFlows: ParamFlow[];
  sideEffects: SideEffect[];
  throws: ThrowInfo[];

  canReturnNull: boolean;
  canReturnUndefined: boolean;

  cyclomaticComplexity: number;
  cognitiveComplexity: number;
}

export interface ParamFlow {
  paramIndex: number;
  paramName: string;
  flowsTo: ParamFlowTarget[];
}

export interface ParamFlowTarget {
  kind: FlowTargetKind;
  target: string;
  transforms: string[];
  isSanitized: boolean;
}

export type FlowTargetKind =
  | "return"
  | "field_write"
  | "db_write"
  | "api_call"
  | "log"
  | "file_write"
  | "exec"
  | "parameter_of_callee";

export interface SideEffect {
  kind: SideEffectKind;
  target: string;
  description: string;
}

export type SideEffectKind =
  | "db_read"
  | "db_write"
  | "api_call"
  | "file_io"
  | "log"
  | "env_read"
  | "cache_access"
  | "event_emit";

export interface ThrowInfo {
  type: string;
  condition?: string;
}
