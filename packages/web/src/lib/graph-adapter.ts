import Graph from "graphology";
import type { GraphData, GraphNodeData, GraphEdgeData } from "@/types/graph";
import { getNodeColor, getEdgeColor } from "./color-system";

export function buildGraphologyInstance(data: GraphData): Graph {
  const graph = new Graph({ multi: true, type: "directed" });

  for (const node of data.nodes) {
    graph.addNode(node.id, {
      label: node.label,
      x: node.x ?? Math.random() * 1000,
      y: node.y ?? Math.random() * 1000,
      size: node.size,
      color: node.color,
      kind: node.kind,
      file: node.file,
      line: node.line,
      language: node.language,
      community: node.community,
      riskScore: node.riskScore,
      isTest: node.isTest,
      isEntryPoint: node.isEntryPoint,
    });
  }

  for (const edge of data.edges) {
    graph.addEdge(edge.source, edge.target, {
      kind: edge.kind,
      weight: edge.weight,
      color: edge.color,
      size: Math.max(1, edge.weight),
    });
  }

  return graph;
}

export function apiNodesToGraphNodes(
  nodes: Array<Record<string, unknown>>,
): GraphNodeData[] {
  return nodes.map((n) => ({
    id: String(n.id),
    label: String(n.name || n.label || n.id),    name: String(n.name || n.label || n.id),    kind: String(n.kind || "unknown"),
    file: String(n.file || ""),
    line: Number(n.line || 0),
    language: String(n.language || ""),
    community: n.community ? String(n.community) : undefined,
    riskScore: n.riskScore ? Number(n.riskScore) : undefined,
    isTest: Boolean(n.isTest),
    isEntryPoint: Boolean(n.isEntryPoint),
    size: computeNodeSize(n),
    color: getNodeColor(String(n.kind || "unknown")),
  }));
}

export function apiEdgesToGraphEdges(
  edges: Array<Record<string, unknown>>,
): GraphEdgeData[] {
  return edges.map((e) => ({
    id: String(e.id || `${e.source}-${e.target}`),
    source: String(e.source),
    target: String(e.target),
    kind: String(e.kind || "unknown"),
    weight: Number(e.weight || 1),
    color: getEdgeColor(String(e.kind || "unknown")),
  }));
}

function computeNodeSize(node: Record<string, unknown>): number {
  const base = 4;
  if (node.isEntryPoint) return base + 6;
  if (node.kind === "class") return base + 4;
  if (node.kind === "function" || node.kind === "method") return base + 2;
  return base;
}
