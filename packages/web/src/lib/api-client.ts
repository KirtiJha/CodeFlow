import ky from "ky";
import type { ApiResponse } from "@/types/api";
import type { TraceMode } from "@/types/trace";

const client = ky.create({
  prefixUrl: "/api",
  timeout: 60000,
  retry: { limit: 2, methods: ["get"] },
  hooks: {
    beforeError: [
      async (error) => {
        const { response } = error;
        if (response) {
          try {
            const body = (await response.json()) as { error?: string };
            if (body.error) {
              error.message = body.error;
            }
          } catch {
            // ignore parse errors
          }
        }
        return error;
      },
    ],
  },
});

export const api = {
  // Clone
  cloneRepo: (url: string) =>
    client
      .post("clone", { json: { url }, timeout: 120000 })
      .json<ApiResponse<{ repoPath: string; alreadyCloned: boolean }>>(),

  // Analysis
  startAnalysis: (repoPath: string) =>
    client
      .post("analyze", { json: { repoPath } })
      .json<ApiResponse<{ jobId: string }>>(),

  getJobStatus: (jobId: string) =>
    client
      .get(`analyze/${encodeURIComponent(jobId)}`)
      .json<ApiResponse<{ status: string; progress: number; phase: string }>>(),

  getStatus: () =>
    client
      .get("status")
      .json<ApiResponse<{ indexed: boolean; repoPath: string; stats: Record<string, number> }>>(),

  // Branches
  getBranches: () =>
    client.get("branches").json<ApiResponse<{ branches: unknown[] }>>(),

  getConflicts: (minSeverity?: string) => {
    const params = minSeverity ? `?minSeverity=${encodeURIComponent(minSeverity)}` : "";
    return client
      .get(`branches/conflicts${params}`)
      .json<ApiResponse<unknown>>();
  },

  diffBranches: (branchA: string, branchB: string) =>
    client
      .post("branches/diff", { json: { branchA, branchB } })
      .json<ApiResponse<unknown>>(),

  prePush: (branch: string) =>
    client
      .post("branches/pre-push", { json: { branch } })
      .json<ApiResponse<unknown>>(),

  // Trace
  traceStaticOrRuntime: (params: {
    file: string;
    symbol?: string;
    from?: string;
    line?: number;
    depth?: number;
    direction?: "forward" | "backward" | "both";
    includeTests?: boolean;
    edgeKinds?: string[];
    sessionId?: string;
    mode?: TraceMode;
    observedOnly?: boolean;
  }) =>
    params.mode === "runtime"
      ? client.post("trace/runtime", { json: params }).json<TraceApiResponse>()
      : client.post("trace", { json: params }).json<TraceApiResponse>(),

  trace: (params: {
    file: string;
    symbol?: string;
    from?: string;
    line?: number;
    depth?: number;
    direction?: "forward" | "backward" | "both";
    includeTests?: boolean;
    edgeKinds?: string[];
  }) =>
    client.post("trace", { json: params }).json<
      ApiResponse<{
        nodes: Array<{
          id: string;
          name: string;
          kind: string;
          file: string;
          line: number;
          column: number;
          depth: number;
          language: string;
          codeSnippet?: string;
        }>;
        edges: Array<{
          id: string;
          source: string;
          target: string;
          kind: string;
          weight: number;
        }>;
        depth: number;
        direction: "forward" | "backward" | "both";
        requestedDirection?: "forward" | "backward" | "both";
        fallbackUsed?: boolean;
      }>
    >(),

  traceSuggest: (q: string, limit = 10) =>
    client
      .get(`trace/suggest?q=${encodeURIComponent(q)}&limit=${limit}`)
      .json<
        ApiResponse<{
          suggestions: Array<{
            id: string;
            symbol: string;
            file: string;
            line: number;
            kind: string;
            language: string;
          }>;
        }>
      >(),

  traceRuntimeSuggest: (q: string, limit = 10, sessionId?: string) => {
    const s = sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : "";
    return client
      .get(`trace/runtime/suggest?q=${encodeURIComponent(q)}&limit=${limit}${s}`)
      .json<
        ApiResponse<{
          suggestions: Array<{
            id: string;
            symbol: string;
            file: string;
            line: number;
            kind: string;
            language: string;
          }>;
        }>
      >();
  },

  traceRuntimeSessions: (limit = 20) =>
    client
      .get(`trace/runtime/sessions?limit=${limit}`)
      .json<
        ApiResponse<{
          sessions: Array<{
            id: string;
            created_at_ms: number;
            updated_at_ms: number;
            edge_count: number;
            observed_edge_count: number;
            bootstrapped_edge_count: number;
          }>;
        }>
      >(),

  ingestRuntimeTraceEvents: (params: {
    sessionId?: string;
    events: Array<{
      timestamp?: number;
      kind?: string;
      fromNodeId?: string;
      toNodeId?: string;
      from?: string;
      to?: string;
      fromFile?: string;
      toFile?: string;
      fromLine?: number;
      toLine?: number;
      metadata?: Record<string, unknown>;
    }>;
  }) => client.post("trace/runtime/events", { json: params }).json<ApiResponse<{ sessionId: string; ingested: number }>>(),

  // Tests
  testImpact: (changedFiles: string[]) =>
    client
      .post("tests/impact", { json: { changedFiles } })
      .json<ApiResponse<unknown>>(),

  testGaps: () => client.get("tests/gaps").json<ApiResponse<unknown>>(),

  // Security
  securityScan: (params?: { path?: string; severity?: string }) =>
    client
      .post("security/scan", { json: params ?? {} })
      .json<ApiResponse<unknown>>(),

  securityReport: () =>
    client.get("security/report").json<ApiResponse<unknown>>(),

  // Schema
  getSchemaModels: (refresh = false) =>
    client.get(`schema/models${refresh ? "?refresh=true" : ""}`).json<ApiResponse<unknown>>(),

  schemaImpact: (model: string, field: string, action: string) =>
    client
      .post("schema/impact", { json: { model, field, action } })
      .json<ApiResponse<unknown>>(),

  // Risk
  riskScore: (target: string) =>
    client
      .post("risk/score", { json: { target } })
      .json<ApiResponse<unknown>>(),

  riskHotspots: (limit?: number) => {
    const params = limit ? `?limit=${limit}` : "";
    return client.get(`risk/hotspots${params}`).json<ApiResponse<unknown>>();
  },

  // Search
  search: (query: string, mode?: string, limit?: number) =>
    client
      .post("search", { json: { query, mode, limit } })
      .json<ApiResponse<unknown>>(),

  context: (symbol: string, depth?: number) =>
    client
      .post("context", { json: { symbol, depth } })
      .json<ApiResponse<unknown>>(),

  graph: () =>
    client
      .get("graph")
      .json<ApiResponse<{ nodes: unknown[]; edges: unknown[] }>>(),

  getSource: (file: string, startLine?: number, endLine?: number) =>
    client
      .post("source", { json: { file, startLine, endLine } })
      .json<ApiResponse<{ file: string; content: string; startLine: number; endLine: number; totalLines: number }>>(),

  nodeDetail: (nodeId: string) =>
    client
      .post("node-detail", { json: { nodeId } })
      .json<ApiResponse<NodeDetailResponse>>(),

  impact: (nodeId: string, depth?: number) =>
    client
      .post("impact", { json: { nodeId, depth } })
      .json<ApiResponse<unknown>>(),

  // Repos
  listRepos: () =>
    client.get("repos").json<
      ApiResponse<{
        repos: Array<{
          id: string;
          name: string;
          path: string;
          dbSize: number;
          isCloned: boolean;
          isActive: boolean;
          stats: {
            nodes: number;
            edges: number;
            files: number;
            functions: number;
            classes: number;
            languages: string[];
            analyzedAt: string | null;
            duration: number | null;
          } | null;
        }>;
      }>
    >(),

  switchRepo: (repoPath: string) =>
    client
      .post("repos/switch", { json: { repoPath } })
      .json<ApiResponse<{ repoPath: string; dbPath: string }>>(),

  deleteRepo: (id: string) =>
    client
      .delete(`repos/${encodeURIComponent(id)}`)
      .json<ApiResponse<{ deleted: string }>>(),
};

type TraceApiResponse = ApiResponse<{
  nodes: Array<{
    id: string;
    name: string;
    kind: string;
    file: string;
    line: number;
    column: number;
    depth: number;
    language: string;
    codeSnippet?: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    kind: string;
    weight: number;
  }>;
  depth: number;
  direction: "forward" | "backward" | "both";
  mode?: TraceMode;
  sessionId?: string;
  runtimeSource?: "observed" | "bootstrapped" | "mixed";
  observedEdgeCount?: number;
  bootstrappedEdgeCount?: number;
  requestedDirection?: "forward" | "backward" | "both";
  fallbackUsed?: boolean;
}>;

export interface NodeDetailResponse {
  node: {
    id: string;
    name: string;
    qualifiedName?: string;
    kind: string;
    file: string;
    line: number;
    endLine: number;
    language: string;
    signature?: string;
    isTest: boolean;
    isEntryPoint: boolean;
    riskScore: number;
    complexity: number;
  };
  fileContent: string;
  totalLines: number;
  siblings: Array<{
    id: string;
    name: string;
    kind: string;
    line: number;
    endLine: number;
    language: string;
    isTest: boolean;
    isEntryPoint: boolean;
    signature: string | null;
  }>;
  callees: Array<{
    id: string;
    name: string;
    kind: string;
    edgeKind: string;
    file: string;
    line: number;
  }>;
  callers: Array<{
    id: string;
    name: string;
    kind: string;
    edgeKind: string;
    file: string;
    line: number;
  }>;
}
