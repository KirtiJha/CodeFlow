import { v4 as uuid } from "uuid";
import type {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  NodeKind,
  EdgeKind,
} from "./types.js";

export type { KnowledgeGraph };

export class InMemoryGraph implements KnowledgeGraph {
  nodes = new Map<string, GraphNode>();
  edges = new Map<string, GraphEdge>();

  private outgoing = new Map<string, Set<string>>();
  private incoming = new Map<string, Set<string>>();
  private nodesByKind = new Map<NodeKind, Set<string>>();
  private nodesByFile = new Map<string, Set<string>>();

  addNode(node: GraphNode): void {
    if (!node.id) node.id = uuid();
    this.nodes.set(node.id, node);

    if (!this.outgoing.has(node.id)) this.outgoing.set(node.id, new Set());
    if (!this.incoming.has(node.id)) this.incoming.set(node.id, new Set());

    let kindSet = this.nodesByKind.get(node.kind);
    if (!kindSet) {
      kindSet = new Set();
      this.nodesByKind.set(node.kind, kindSet);
    }
    kindSet.add(node.id);

    let fileSet = this.nodesByFile.get(node.filePath);
    if (!fileSet) {
      fileSet = new Set();
      this.nodesByFile.set(node.filePath, fileSet);
    }
    fileSet.add(node.id);
  }

  addEdge(edge: GraphEdge): void {
    if (!edge.id) edge.id = uuid();
    this.edges.set(edge.id, edge);

    let out = this.outgoing.get(edge.sourceId);
    if (!out) {
      out = new Set();
      this.outgoing.set(edge.sourceId, out);
    }
    out.add(edge.id);

    let inc = this.incoming.get(edge.targetId);
    if (!inc) {
      inc = new Set();
      this.incoming.set(edge.targetId, inc);
    }
    inc.add(edge.id);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getEdge(id: string): GraphEdge | undefined {
    return this.edges.get(id);
  }

  removeNode(id: string): void {
    const node = this.nodes.get(id);
    if (!node) return;

    // Remove all edges connected to this node
    const outEdges = this.outgoing.get(id);
    if (outEdges) {
      for (const edgeId of outEdges) {
        const edge = this.edges.get(edgeId);
        if (edge) {
          this.incoming.get(edge.targetId)?.delete(edgeId);
          this.edges.delete(edgeId);
        }
      }
    }

    const inEdges = this.incoming.get(id);
    if (inEdges) {
      for (const edgeId of inEdges) {
        const edge = this.edges.get(edgeId);
        if (edge) {
          this.outgoing.get(edge.sourceId)?.delete(edgeId);
          this.edges.delete(edgeId);
        }
      }
    }

    this.outgoing.delete(id);
    this.incoming.delete(id);
    this.nodesByKind.get(node.kind)?.delete(id);
    this.nodesByFile.get(node.filePath)?.delete(id);
    this.nodes.delete(id);
  }

  removeEdge(id: string): void {
    const edge = this.edges.get(id);
    if (!edge) return;

    this.outgoing.get(edge.sourceId)?.delete(id);
    this.incoming.get(edge.targetId)?.delete(id);
    this.edges.delete(id);
  }

  /**
   * Re-index an edge after its sourceId or targetId has been mutated.
   * Call this whenever you update edge.sourceId / edge.targetId outside of addEdge.
   */
  reindexEdge(edgeId: string, oldSourceId: string, oldTargetId: string): void {
    const edge = this.edges.get(edgeId);
    if (!edge) return;

    // Remove from old indices
    this.outgoing.get(oldSourceId)?.delete(edgeId);
    this.incoming.get(oldTargetId)?.delete(edgeId);

    // Add to new indices
    let out = this.outgoing.get(edge.sourceId);
    if (!out) {
      out = new Set();
      this.outgoing.set(edge.sourceId, out);
    }
    out.add(edgeId);

    let inc = this.incoming.get(edge.targetId);
    if (!inc) {
      inc = new Set();
      this.incoming.set(edge.targetId, inc);
    }
    inc.add(edgeId);
  }

  getOutgoingEdges(nodeId: string, kind?: EdgeKind): GraphEdge[] {
    const edgeIds = this.outgoing.get(nodeId);
    if (!edgeIds) return [];

    const results: GraphEdge[] = [];
    for (const edgeId of edgeIds) {
      const edge = this.edges.get(edgeId);
      if (edge && (!kind || edge.kind === kind)) {
        results.push(edge);
      }
    }
    return results;
  }

  getIncomingEdges(nodeId: string, kind?: EdgeKind): GraphEdge[] {
    const edgeIds = this.incoming.get(nodeId);
    if (!edgeIds) return [];

    const results: GraphEdge[] = [];
    for (const edgeId of edgeIds) {
      const edge = this.edges.get(edgeId);
      if (edge && (!kind || edge.kind === kind)) {
        results.push(edge);
      }
    }
    return results;
  }

  getNeighbors(nodeId: string, kind?: EdgeKind): GraphNode[] {
    const neighbors: GraphNode[] = [];
    const seen = new Set<string>();

    for (const edge of this.getOutgoingEdges(nodeId, kind)) {
      if (!seen.has(edge.targetId)) {
        seen.add(edge.targetId);
        const node = this.nodes.get(edge.targetId);
        if (node) neighbors.push(node);
      }
    }

    for (const edge of this.getIncomingEdges(nodeId, kind)) {
      if (!seen.has(edge.sourceId)) {
        seen.add(edge.sourceId);
        const node = this.nodes.get(edge.sourceId);
        if (node) neighbors.push(node);
      }
    }

    return neighbors;
  }

  getNodesByKind(kind: NodeKind): GraphNode[] {
    const ids = this.nodesByKind.get(kind);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.nodes.get(id))
      .filter((n): n is GraphNode => n !== undefined);
  }

  getNodesByFile(filePath: string): GraphNode[] {
    const ids = this.nodesByFile.get(filePath);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.nodes.get(id))
      .filter((n): n is GraphNode => n !== undefined);
  }

  getEdgesByKind(kind: EdgeKind): GraphEdge[] {
    const results: GraphEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.kind === kind) results.push(edge);
    }
    return results;
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    return this.edges.size;
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.outgoing.clear();
    this.incoming.clear();
    this.nodesByKind.clear();
    this.nodesByFile.clear();
  }
}
