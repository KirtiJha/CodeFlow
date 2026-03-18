import type { DataFlowGraph } from "./dfg-types.js";

export interface UseDefChain {
  use: { nodeId: string; variable: string };
  defs: Array<{ nodeId: string; variable: string }>;
}

export interface DefUseChain {
  def: { nodeId: string; variable: string };
  uses: Array<{ nodeId: string; variable: string }>;
}

/**
 * Compute use-def and def-use chains from a DFG.
 * Use-def: for each use, which definitions can it come from?
 * Def-use: for each definition, where is it used?
 */
export class UseDefChains {
  computeUseDefChains(dfg: DataFlowGraph): UseDefChain[] {
    const chains: UseDefChain[] = [];

    // A "use" is any DFG node that reads a value (has incoming data_dep edges)
    for (const node of dfg.nodes.values()) {
      const inEdges = dfg.edges.filter(
        (e) =>
          e.targetId === node.id &&
          (e.kind === "data_dep" || e.kind === "field_flow"),
      );

      if (inEdges.length > 0) {
        const defs = inEdges
          .map((e) => {
            const defNode = dfg.nodes.get(e.sourceId);
            return defNode
              ? { nodeId: defNode.id, variable: defNode.code ?? "" }
              : null;
          })
          .filter((d): d is NonNullable<typeof d> => d !== null);

        chains.push({
          use: { nodeId: node.id, variable: node.code ?? "" },
          defs,
        });
      }
    }

    return chains;
  }

  computeDefUseChains(dfg: DataFlowGraph): DefUseChain[] {
    const chains: DefUseChain[] = [];

    for (const node of dfg.nodes.values()) {
      if (node.kind !== "param" && node.kind !== "assignment") continue;

      const outEdges = dfg.edges.filter(
        (e) =>
          e.sourceId === node.id &&
          (e.kind === "data_dep" || e.kind === "field_flow"),
      );

      const uses = outEdges
        .map((e) => {
          const useNode = dfg.nodes.get(e.targetId);
          return useNode
            ? { nodeId: useNode.id, variable: useNode.code ?? "" }
            : null;
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);

      chains.push({
        def: { nodeId: node.id, variable: node.code ?? "" },
        uses,
      });
    }

    return chains;
  }
}
