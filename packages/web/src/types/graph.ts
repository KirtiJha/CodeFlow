export interface GraphNodeData {
  id: string;
  label: string;
  name: string;
  kind: string;
  file: string;
  line: number;
  language: string;
  community?: string;
  riskScore?: number;
  isTest: boolean;
  isEntryPoint: boolean;
  size: number;
  color: string;
  x?: number;
  y?: number;
  inDegree?: number;
  outDegree?: number;
  codeSnippet?: string;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  kind: string;
  weight: number;
  color: string;
}

export interface GraphData {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  communities: CommunityInfo[];
  stats: GraphStats;
}

export interface CommunityInfo {
  id: string;
  label: string;
  nodeCount: number;
  color: string;
  topNodes: string[];
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  communityCount: number;
  density: number;
  avgDegree: number;
}

export interface GraphFilter {
  kinds: string[];
  languages: string[];
  communities: string[];
  minRisk: number;
  showTests: boolean;
  showEntryPoints: boolean;
  searchQuery: string;
}
