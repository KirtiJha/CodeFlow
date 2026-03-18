import type { DataFlowGraph, DFGNode, DFGEdge } from "../dfg/dfg-types.js";
import type { ControlFlowGraph } from "../cfg/cfg-types.js";
import type {
  FunctionSummary,
  ParamFlow,
  ParamFlowTarget,
  FlowTargetKind,
  SideEffect,
  ThrowInfo,
} from "./summary-types.js";
import { v4 as uuid } from "uuid";
import { createLogger } from "../utils/logger.js";

const log = createLogger("summaries:builder");

/**
 * Builds function summaries from DFG + CFG analysis.
 * Summaries describe behavioral characteristics: what data flows where,
 * what side effects occur, and error behaviors.
 *
 * Built bottom-up: leaf functions first, then callers compose callee summaries.
 */
export class SummaryBuilder {
  private readonly summaries = new Map<string, FunctionSummary>();

  /**
   * Build a summary for a single function given its analysis artifacts.
   */
  buildSummary(
    functionId: string,
    name: string,
    filePath: string,
    dfg: DataFlowGraph,
    cfg: ControlFlowGraph,
    calleeSummaries: Map<string, FunctionSummary>,
  ): FunctionSummary {
    const paramFlows = this.traceParamFlows(dfg, calleeSummaries);
    const sideEffects = this.detectSideEffects(dfg, calleeSummaries);
    const throws = this.detectThrows(cfg);
    const canReturnNull = this.checkCanReturnNull(dfg);
    const canReturnUndefined = this.checkCanReturnUndefined(dfg);
    const cyclomaticComplexity = this.computeCyclomaticComplexity(cfg);
    const cognitiveComplexity = this.computeCognitiveComplexity(cfg);

    const summary: FunctionSummary = {
      id: uuid(),
      nodeId: functionId,
      name,
      filePath,
      paramFlows,
      sideEffects,
      throws,
      canReturnNull,
      canReturnUndefined,
      cyclomaticComplexity,
      cognitiveComplexity,
    };

    this.summaries.set(functionId, summary);
    return summary;
  }

  /**
   * Build summaries in dependency order (bottom-up).
   * callOrder: function IDs sorted topologically with leaves first.
   */
  buildAll(
    callOrder: string[],
    dfgs: Map<string, DataFlowGraph>,
    cfgs: Map<string, ControlFlowGraph>,
    functionMeta: Map<string, { name: string; filePath: string }>,
    calleeMap: Map<string, string[]>, // functionId → callee functionIds
  ): Map<string, FunctionSummary> {
    const MAX_ROUNDS = 3;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      let changed = false;

      for (const funcId of callOrder) {
        const dfg = dfgs.get(funcId);
        const cfg = cfgs.get(funcId);
        const meta = functionMeta.get(funcId);
        if (!dfg || !cfg || !meta) continue;

        // Collect callee summaries
        const callees = calleeMap.get(funcId) ?? [];
        const calleeSummaries = new Map<string, FunctionSummary>();
        for (const calleeId of callees) {
          const s = this.summaries.get(calleeId);
          if (s) calleeSummaries.set(calleeId, s);
        }

        const prev = this.summaries.get(funcId);
        const summary = this.buildSummary(
          funcId,
          meta.name,
          meta.filePath,
          dfg,
          cfg,
          calleeSummaries,
        );

        if (!prev || !this.summariesEqual(prev, summary)) {
          changed = true;
        }
      }

      if (!changed) {
        log.debug({ round }, "Summary fixed-point reached");
        break;
      }
    }

    return new Map(this.summaries);
  }

  getSummary(functionId: string): FunctionSummary | undefined {
    return this.summaries.get(functionId);
  }

  /**
   * Trace how each parameter flows through the function.
   */
  private traceParamFlows(
    dfg: DataFlowGraph,
    calleeSummaries: Map<string, FunctionSummary>,
  ): ParamFlow[] {
    const flows: ParamFlow[] = [];

    for (let i = 0; i < dfg.params.length; i++) {
      const paramId = dfg.params[i];
      if (!paramId) continue;
      const paramNode = dfg.nodes.get(paramId);
      if (!paramNode) continue;

      const targets = this.traceForward(
        paramId,
        dfg,
        calleeSummaries,
        new Set(),
      );

      flows.push({
        paramIndex: i,
        paramName: paramNode.code ?? "",
        flowsTo: targets,
      });
    }

    return flows;
  }

  /**
   * Forward-trace a DFG node through all data_dep and param_bind edges.
   */
  private traceForward(
    nodeId: string,
    dfg: DataFlowGraph,
    calleeSummaries: Map<string, FunctionSummary>,
    visited: Set<string>,
  ): ParamFlowTarget[] {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    const targets: ParamFlowTarget[] = [];
    const outEdges = dfg.edges.filter((e) => e.sourceId === nodeId);

    for (const edge of outEdges) {
      const targetNode = dfg.nodes.get(edge.targetId);
      if (!targetNode) continue;

      const flowTarget = this.classifyFlowTarget(targetNode, edge);
      if (flowTarget) {
        targets.push(flowTarget);
      }

      // Continue tracing forward
      const further = this.traceForward(
        edge.targetId,
        dfg,
        calleeSummaries,
        visited,
      );
      targets.push(...further);
    }

    return targets;
  }

  /**
   * Classify what kind of target a DFG node represents.
   */
  private classifyFlowTarget(
    node: DFGNode,
    edge: DFGEdge,
  ): ParamFlowTarget | null {
    if (node.kind === "return") {
      return {
        kind: "return",
        target: "return",
        transforms: edge.transform ? [edge.transform] : [],
        isSanitized: edge.isSanitizing ?? false,
      };
    }

    if (node.kind === "field_write") {
      const kind = this.classifyFieldWriteKind(node);
      return {
        kind,
        target: node.code,
        transforms: edge.transform ? [edge.transform] : [],
        isSanitized: edge.isSanitizing ?? false,
      };
    }

    if (node.kind === "call_result" && node.isSink) {
      const kind = this.classifySinkKind(node);
      return {
        kind,
        target: node.code,
        transforms: edge.transform ? [edge.transform] : [],
        isSanitized: edge.isSanitizing ?? false,
      };
    }

    if (edge.kind === "param_bind") {
      return {
        kind: "parameter_of_callee",
        target: node.code,
        transforms: [],
        isSanitized: false,
      };
    }

    return null;
  }

  private classifyFieldWriteKind(node: DFGNode): FlowTargetKind {
    const code = node.code.toLowerCase();
    if (code.includes("db.") || code.includes("query") || code.includes("save"))
      return "db_write";
    if (code.includes("log")) return "log";
    if (code.includes("write") || code.includes("fs.")) return "file_write";
    if (code.includes("exec") || code.includes("spawn")) return "exec";
    return "field_write";
  }

  private classifySinkKind(node: DFGNode): FlowTargetKind {
    if (!node.sinkKind) return "api_call";
    switch (node.sinkKind) {
      case "database":
      case "sql_execution":
        return "db_write";
      case "log":
        return "log";
      case "file_write":
        return "file_write";
      case "exec":
      case "eval":
        return "exec";
      default:
        return "api_call";
    }
  }

  /**
   * Detect side effects (operations independent of parameter flow).
   */
  private detectSideEffects(
    dfg: DataFlowGraph,
    calleeSummaries: Map<string, FunctionSummary>,
  ): SideEffect[] {
    const effects: SideEffect[] = [];

    for (const [, node] of dfg.nodes) {
      if (node.isSink) {
        const effect = this.classifySideEffect(node);
        if (effect) effects.push(effect);
      }

      if (node.isSource) {
        const readEffect = this.classifyReadEffect(node);
        if (readEffect) effects.push(readEffect);
      }
    }

    // Compose callee side effects
    for (const [, calleeSummary] of calleeSummaries) {
      for (const effect of calleeSummary.sideEffects) {
        effects.push({
          ...effect,
          description: `via ${calleeSummary.name}: ${effect.description}`,
        });
      }
    }

    return this.deduplicateEffects(effects);
  }

  private classifySideEffect(node: DFGNode): SideEffect | null {
    if (!node.sinkKind) return null;

    switch (node.sinkKind) {
      case "database":
      case "sql_execution":
        return {
          kind: "db_write",
          target: node.code,
          description: `DB write: ${node.code}`,
        };
      case "log":
        return {
          kind: "log",
          target: node.code,
          description: `Log: ${node.code}`,
        };
      case "file_write":
        return {
          kind: "file_io",
          target: node.code,
          description: `File write: ${node.code}`,
        };
      case "external_api":
      case "http_response":
        return {
          kind: "api_call",
          target: node.code,
          description: `API call: ${node.code}`,
        };
      case "exec":
      case "eval":
        return {
          kind: "file_io",
          target: node.code,
          description: `Exec: ${node.code}`,
        };
      default:
        return null;
    }
  }

  private classifyReadEffect(node: DFGNode): SideEffect | null {
    if (!node.sourceKind) return null;

    switch (node.sourceKind) {
      case "db_read":
        return {
          kind: "db_read",
          target: node.code,
          description: `DB read: ${node.code}`,
        };
      case "env_var":
        return {
          kind: "env_read",
          target: node.code,
          description: `Env read: ${node.code}`,
        };
      case "file_read":
        return {
          kind: "file_io",
          target: node.code,
          description: `File read: ${node.code}`,
        };
      case "api_response":
        return {
          kind: "api_call",
          target: node.code,
          description: `API response: ${node.code}`,
        };
      default:
        return null;
    }
  }

  private deduplicateEffects(effects: SideEffect[]): SideEffect[] {
    const seen = new Set<string>();
    return effects.filter((e) => {
      const key = `${e.kind}:${e.target}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Detect throw statements from CFG.
   */
  private detectThrows(cfg: ControlFlowGraph): ThrowInfo[] {
    const throws: ThrowInfo[] = [];

    for (const [, block] of cfg.blocks) {
      if (block.kind === "throw") {
        for (const stmt of block.statements) {
          const type = this.extractThrowType(stmt.text ?? "");
          throws.push({ type, condition: undefined });
        }
      }
    }

    return throws;
  }

  private extractThrowType(code: string): string {
    // Match: throw new Error(...), throw new TypeError(...)
    const match = code.match(/throw\s+new\s+(\w+)/);
    if (match) return match[1] ?? "Error";

    // Match: raise ValueError(...)
    const pyMatch = code.match(/raise\s+(\w+)/);
    if (pyMatch) return pyMatch[1] ?? "Error";

    return "Error";
  }

  private checkCanReturnNull(dfg: DataFlowGraph): boolean {
    for (const retId of dfg.returns) {
      const retNode = dfg.nodes.get(retId);
      if (!retNode) continue;

      // Check incoming edges for null-producing nodes
      const inEdges = dfg.edges.filter((e) => e.targetId === retId);
      for (const edge of inEdges) {
        const sourceNode = dfg.nodes.get(edge.sourceId);
        if (sourceNode?.code === "null" || sourceNode?.code === "None")
          return true;
      }

      if (retNode.code.includes("null") || retNode.code.includes("None"))
        return true;
    }

    return false;
  }

  private checkCanReturnUndefined(dfg: DataFlowGraph): boolean {
    for (const retId of dfg.returns) {
      const retNode = dfg.nodes.get(retId);
      if (!retNode) continue;
      if (retNode.code === "return" || retNode.code.includes("undefined"))
        return true;
    }
    return false;
  }

  private computeCyclomaticComplexity(cfg: ControlFlowGraph): number {
    const E = cfg.edges.length;
    const N = cfg.blocks.size;
    return E - N + 2;
  }

  private computeCognitiveComplexity(cfg: ControlFlowGraph): number {
    let complexity = 0;
    let nesting = 0;

    for (const [, block] of cfg.blocks) {
      if (block.kind === "branch" || block.kind === "loop_header") {
        complexity += 1 + nesting;
        nesting++;
      }
      if (block.kind === "catch") {
        complexity += 1 + nesting;
      }
    }

    return complexity;
  }

  private summariesEqual(a: FunctionSummary, b: FunctionSummary): boolean {
    return (
      a.paramFlows.length === b.paramFlows.length &&
      a.sideEffects.length === b.sideEffects.length &&
      a.throws.length === b.throws.length &&
      a.canReturnNull === b.canReturnNull &&
      a.canReturnUndefined === b.canReturnUndefined
    );
  }
}
