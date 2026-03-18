import ky from "ky";
import type { ApiResponse } from "@/types/api";

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
      .json<ApiResponse<{ repoPath: string; stats: Record<string, number> }>>(),

  // Branches
  getBranches: () =>
    client.get("branches").json<ApiResponse<{ branches: unknown[] }>>(),

  getConflicts: (severity?: string) => {
    const params = severity ? `?severity=${encodeURIComponent(severity)}` : "";
    return client
      .get(`branches/conflicts${params}`)
      .json<ApiResponse<{ conflicts: unknown[] }>>();
  },

  diffBranches: (branch: string, base: string) =>
    client
      .post("branches/diff", { json: { branch, base } })
      .json<ApiResponse<unknown>>(),

  prePush: (branch: string) =>
    client
      .post("branches/pre-push", { json: { branch } })
      .json<ApiResponse<unknown>>(),

  // Trace
  trace: (params: {
    file: string;
    symbol?: string;
    line?: number;
    depth?: number;
    direction?: string;
  }) => client.post("trace", { json: params }).json<ApiResponse<unknown>>(),

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
  getSchemaModels: () =>
    client.get("schema/models").json<ApiResponse<unknown>>(),

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

  impact: (nodeId: string, depth?: number) =>
    client
      .post("impact", { json: { nodeId, depth } })
      .json<ApiResponse<unknown>>(),
};
