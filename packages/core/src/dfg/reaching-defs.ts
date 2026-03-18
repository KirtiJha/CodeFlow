import type { DataFlowGraph, ReachingDef } from "./dfg-types.js";

/**
 * Reaching definitions analysis.
 * For each point in the DFG, determines which definitions can reach that point.
 */
export class ReachingDefinitions {
  /**
   * Compute reaching definitions for all nodes in the DFG.
   */
  compute(dfg: DataFlowGraph): Map<string, ReachingDef[]> {
    const result = new Map<string, ReachingDef[]>();

    // Initialize: each definition point reaches itself
    for (const node of dfg.nodes.values()) {
      if (node.kind === "param" || node.kind === "assignment") {
        result.set(node.id, [
          {
            variable: node.code ?? "",
            definedAt: node.id,
            reachesTo: [],
          },
        ]);
      } else {
        result.set(node.id, []);
      }
    }

    // Fixed-point iteration
    let changed = true;
    let iterations = 0;
    const MAX_ITERATIONS = 100;

    while (changed && iterations < MAX_ITERATIONS) {
      changed = false;
      iterations++;

      for (const edge of dfg.edges) {
        if (edge.kind !== "data_dep" && edge.kind !== "param_bind") continue;

        const sourceDefs = result.get(edge.sourceId) ?? [];
        const targetDefs = result.get(edge.targetId) ?? [];

        // Propagate reaching defs from source to target
        for (const def of sourceDefs) {
          const alreadyReaches = targetDefs.some(
            (d) => d.definedAt === def.definedAt && d.variable === def.variable,
          );
          if (!alreadyReaches) {
            targetDefs.push({
              ...def,
              reachesTo: [...(def.reachesTo ?? []), edge.targetId],
            });
            changed = true;
          }
        }

        result.set(edge.targetId, targetDefs);
      }
    }

    return result;
  }

  /**
   * For a given node, find all definitions that reach it for a specific variable.
   */
  getDefsReaching(
    reachingDefs: Map<string, ReachingDef[]>,
    nodeId: string,
    variable: string,
  ): ReachingDef[] {
    const defs = reachingDefs.get(nodeId) ?? [];
    return defs.filter((d) => d.variable === variable);
  }
}
