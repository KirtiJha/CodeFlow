import type {
  DataFlowGraph,
  SSAVariable,
  PhiNode,
  DFGNode,
} from "./dfg-types.js";
import { v4 as uuid } from "uuid";

/**
 * SSA (Static Single Assignment) transformation for a data flow graph.
 * Renames variables so each assignment gets a unique version,
 * inserting phi nodes at CFG merge points.
 */
export class SSATransform {
  private versions = new Map<string, number>();
  private ssaVars: SSAVariable[] = [];
  private phiNodes: PhiNode[] = [];

  /**
   * Transform a DFG into SSA form.
   * Returns the SSA variables and phi nodes.
   */
  transform(dfg: DataFlowGraph): SSAResult {
    this.reset();

    // Phase 1: Assign version numbers to each definition
    for (const node of dfg.nodes.values()) {
      if (node.kind === "param" || node.kind === "assignment") {
        const name = node.code ?? `_v${node.id.slice(0, 8)}`;
        const version = this.nextVersion(name);

        this.ssaVars.push({
          originalName: name,
          version,
          definedAt: node.id,
          usedAt: [],
        });
      }
    }

    // Phase 2: Link uses to their reaching definitions
    for (const edge of dfg.edges) {
      if (edge.kind === "data_dep") {
        const sourceNode = dfg.nodes.get(edge.sourceId);
        const targetNode = dfg.nodes.get(edge.targetId);
        if (sourceNode && targetNode) {
          const ssaVar = this.ssaVars.find(
            (v) => v.definedAt === edge.sourceId,
          );
          if (ssaVar) {
            ssaVar.usedAt?.push(edge.targetId);
          }
        }
      }
    }

    // Phase 3: Insert phi nodes at merge points
    // Merge points are DFG nodes with multiple incoming data_dep edges
    const inCount = new Map<string, string[]>();
    for (const edge of dfg.edges) {
      if (edge.kind === "data_dep") {
        const existing = inCount.get(edge.targetId) ?? [];
        existing.push(edge.sourceId);
        inCount.set(edge.targetId, existing);
      }
    }

    for (const [targetId, sources] of inCount) {
      if (sources.length > 1) {
        const targetNode = dfg.nodes.get(targetId);
        if (targetNode) {
          this.phiNodes.push({
            id: uuid(),
            variable: targetNode.code ?? "",
            incomingVersions: sources.map((srcId) => {
              const ssaVar = this.ssaVars.find((v) => v.definedAt === srcId);
              return {
                blockId: srcId,
                version: ssaVar?.version ?? 0,
              };
            }),
            resultVersion: this.nextVersion(targetNode.code ?? ""),
          });
        }
      }
    }

    return {
      variables: this.ssaVars,
      phiNodes: this.phiNodes,
    };
  }

  private nextVersion(name: string): number {
    const current = this.versions.get(name) ?? 0;
    const next = current + 1;
    this.versions.set(name, next);
    return next;
  }

  private reset(): void {
    this.versions.clear();
    this.ssaVars = [];
    this.phiNodes = [];
  }
}

export interface SSAResult {
  variables: SSAVariable[];
  phiNodes: PhiNode[];
}
