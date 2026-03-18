import type { KnowledgeGraph, GraphEdge, GraphNode } from "../graph/types.js";
import { v4 as uuid } from "uuid";
import { createLogger } from "../utils/logger.js";

const log = createLogger("community:leiden");

export interface Community {
  id: string;
  label: string;
  level: number;
  nodeIds: string[];
  parentId?: string;
}

export interface LeidenOptions {
  resolution: number;
  maxIterations: number;
  minCommunitySize: number;
  dataFlowWeight: number;
  callWeight: number;
}

const DEFAULT_OPTIONS: LeidenOptions = {
  resolution: 1.0,
  maxIterations: 50,
  minCommunitySize: 2,
  dataFlowWeight: 2.0,
  callWeight: 1.0,
};

/**
 * Leiden community detection on the knowledge graph.
 * Uses combined CALLS + DATA_FLOW edges with configurable weights.
 * Data flow edges receive higher weight (functions that share data
 * belong together more strongly than functions that merely call each other).
 */
export class LeidenDetector {
  private readonly options: LeidenOptions;

  constructor(options: Partial<LeidenOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Detect communities in the knowledge graph.
   * Returns a map of nodeId → communityId.
   */
  detect(graph: KnowledgeGraph): Map<string, string> {
    // Build adjacency with weighted edges
    const nodes = this.getCallableNodes(graph);
    const nodeIds = nodes.map((n) => n.id);
    const nodeIndex = new Map<string, number>();
    nodeIds.forEach((id, i) => nodeIndex.set(id, i));

    if (nodeIds.length === 0) return new Map();

    // Build weighted adjacency matrix (sparse)
    const adjacency = this.buildWeightedAdjacency(graph, nodeIndex);

    // Initial partition: each node in its own community
    const partition = new Array(nodeIds.length);
    for (let i = 0; i < nodeIds.length; i++) {
      partition[i] = i;
    }

    // Leiden iterative refinement
    let improved = true;
    let iteration = 0;

    while (improved && iteration < this.options.maxIterations) {
      improved = false;
      iteration++;

      // Phase 1: Local moving — try moving each node to neighbor's community
      for (let i = 0; i < nodeIds.length; i++) {
        const neighbors = adjacency.get(i);
        if (!neighbors) continue;

        const currentCommunity = partition[i];
        let bestCommunity = currentCommunity;
        let bestGain = 0;

        // Evaluate each neighboring community
        const neighborCommunities = new Set<number>();
        for (const [j] of neighbors) {
          neighborCommunities.add(partition[j]);
        }

        for (const community of neighborCommunities) {
          if (community === currentCommunity) continue;
          const gain = this.modularityGain(
            i,
            community,
            partition,
            adjacency,
            nodeIds.length,
          );
          if (gain > bestGain) {
            bestGain = gain;
            bestCommunity = community;
          }
        }

        if (bestCommunity !== currentCommunity) {
          partition[i] = bestCommunity;
          improved = true;
        }
      }

      // Phase 2: Refinement — merge small communities
      this.refinePartition(partition, adjacency, nodeIds.length);
    }

    log.debug(
      { iterations: iteration, nodes: nodeIds.length },
      "Leiden completed",
    );

    // Build community map
    const communityMap = new Map<string, string>();
    const communityIds = new Map<number, string>();

    for (let i = 0; i < nodeIds.length; i++) {
      const comm = partition[i] ?? 0;
      if (!communityIds.has(comm)) {
        communityIds.set(comm, uuid());
      }
      const nodeId = nodeIds[i];
      if (nodeId) {
        communityMap.set(nodeId, communityIds.get(comm)!);
      }
    }

    return communityMap;
  }

  /**
   * Build community objects with member lists.
   */
  buildCommunities(
    graph: KnowledgeGraph,
    communityMap: Map<string, string>,
  ): Community[] {
    const communities = new Map<string, string[]>();

    for (const [nodeId, commId] of communityMap) {
      const list = communities.get(commId);
      if (list) {
        list.push(nodeId);
      } else {
        communities.set(commId, [nodeId]);
      }
    }

    return Array.from(communities.entries())
      .filter(([, members]) => members.length >= this.options.minCommunitySize)
      .map(([id, members]) => ({
        id,
        label: "",
        level: 0,
        nodeIds: members,
      }));
  }

  private getCallableNodes(graph: KnowledgeGraph): GraphNode[] {
    const callableKinds = new Set([
      "function",
      "method",
      "constructor",
      "class",
      "module",
    ]);
    return [...graph.nodes.values()].filter((n) => callableKinds.has(n.kind));
  }

  private buildWeightedAdjacency(
    graph: KnowledgeGraph,
    nodeIndex: Map<string, number>,
  ): Map<number, Map<number, number>> {
    const adj = new Map<number, Map<number, number>>();

    for (const [, edge] of graph.edges) {
      const si = nodeIndex.get(edge.sourceId);
      const ti = nodeIndex.get(edge.targetId);
      if (si === undefined || ti === undefined) continue;

      let weight = 0;
      if (edge.kind === "calls") weight = this.options.callWeight;
      else if (edge.kind === "data_flow") weight = this.options.dataFlowWeight;
      else continue;

      // Undirected for community detection
      this.addEdge(adj, si, ti, weight);
      this.addEdge(adj, ti, si, weight);
    }

    return adj;
  }

  private addEdge(
    adj: Map<number, Map<number, number>>,
    from: number,
    to: number,
    weight: number,
  ): void {
    let neighbors = adj.get(from);
    if (!neighbors) {
      neighbors = new Map();
      adj.set(from, neighbors);
    }
    neighbors.set(to, (neighbors.get(to) ?? 0) + weight);
  }

  private modularityGain(
    nodeIdx: number,
    targetCommunity: number,
    partition: number[],
    adjacency: Map<number, Map<number, number>>,
    totalNodes: number,
  ): number {
    const neighbors = adjacency.get(nodeIdx);
    if (!neighbors) return 0;

    let sumIn = 0;
    let sumOut = 0;

    for (const [j, w] of neighbors) {
      if ((partition[j] ?? -1) === targetCommunity) sumIn += w;
      if ((partition[j] ?? -1) === (partition[nodeIdx] ?? -2)) sumOut += w;
    }

    return (sumIn - sumOut) * this.options.resolution;
  }

  private refinePartition(
    partition: number[],
    adjacency: Map<number, Map<number, number>>,
    totalNodes: number,
  ): void {
    // Count community sizes
    const sizes = new Map<number, number>();
    for (const c of partition) {
      sizes.set(c, (sizes.get(c) ?? 0) + 1);
    }

    // Merge communities smaller than minCommunitySize into the nearest larger one
    for (let i = 0; i < partition.length; i++) {
      const comm = partition[i] ?? 0;
      if ((sizes.get(comm) ?? 0) >= this.options.minCommunitySize) continue;

      const neighbors = adjacency.get(i);
      if (!neighbors) continue;

      // Find the largest neighboring community
      let bestComm = comm;
      let bestSize = 0;

      for (const [j] of neighbors) {
        const nComm = partition[j] ?? 0;
        const nSize = sizes.get(nComm) ?? 0;
        if (nSize > bestSize && nSize >= this.options.minCommunitySize) {
          bestSize = nSize;
          bestComm = nComm;
        }
      }

      if (bestComm !== comm) {
        sizes.set(comm, (sizes.get(comm) ?? 1) - 1);
        sizes.set(bestComm, (sizes.get(bestComm) ?? 0) + 1);
        partition[i] = bestComm;
      }
    }
  }
}
