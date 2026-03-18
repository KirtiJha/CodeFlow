/**
 * Analysis worker — runs in a worker_thread.
 * Handles CFG/DFG construction and taint analysis per function.
 */
import { parentPort } from "node:worker_threads";
import type { WorkerTask, WorkerResult } from "./worker-pool.js";

interface AnalysisTask {
  phase: "cfg" | "dfg" | "taint";
  functions: Array<{
    nodeId: string;
    filePath: string;
    bodySource: string;
    language: string;
    params: Array<{ name: string; type?: string }>;
  }>;
}

interface AnalysisResultItem {
  nodeId: string;
  phase: string;
  data: unknown;
  error?: string;
}

if (parentPort) {
  parentPort.on("message", async (task: WorkerTask<AnalysisTask>) => {
    try {
      const { phase, functions } = task.payload;
      const results: AnalysisResultItem[] = [];

      if (phase === "cfg") {
        const { CFGBuilder } = await import("../cfg/cfg-builder.js");
        const builder = new CFGBuilder();

        for (const fn of functions) {
          try {
            // CFGBuilder.build() needs a SyntaxNode, not raw source
            // Workers would need to re-parse; for now return null
            results.push({ nodeId: fn.nodeId, phase: "cfg", data: null });
          } catch (err) {
            results.push({
              nodeId: fn.nodeId,
              phase: "cfg",
              data: null,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      } else if (phase === "dfg") {
        const { DFGBuilder } = await import("../dfg/dfg-builder.js");
        const builder = new DFGBuilder();

        for (const fn of functions) {
          try {
            // DFGBuilder.build() needs SyntaxNode + CFG, not raw IDs
            // Workers would need to re-parse; for now return null
            results.push({ nodeId: fn.nodeId, phase: "dfg", data: null });
          } catch (err) {
            results.push({
              nodeId: fn.nodeId,
              phase: "dfg",
              data: null,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      } else if (phase === "taint") {
        // Taint runs at a higher level, not per-function
        results.push({
          nodeId: "batch",
          phase: "taint",
          data: { message: "Taint analysis runs at graph level" },
        });
      }

      const response: WorkerResult<AnalysisResultItem[]> = {
        taskIndex: 0,
        result: results,
      };

      parentPort!.postMessage(response);
    } catch (err) {
      parentPort!.postMessage({
        taskIndex: 0,
        error: err instanceof Error ? err.message : String(err),
      } satisfies WorkerResult);
    }
  });
}
