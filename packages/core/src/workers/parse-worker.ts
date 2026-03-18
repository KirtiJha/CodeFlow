/**
 * Parse worker — runs in a worker_thread.
 * Receives file chunks, runs tree-sitter parsing + symbol extraction,
 * returns serialized results via structured clone.
 */
import { parentPort } from "node:worker_threads";
import type { WorkerTask, WorkerResult } from "./worker-pool.js";

interface ParseTask {
  files: Array<{ path: string; content: string; language: string }>;
}

interface ParseResultItem {
  filePath: string;
  symbols: unknown[];
  imports: unknown[];
  calls: unknown[];
  heritage: unknown[];
  errors: string[];
}

// Lazy-load parser to avoid startup cost when not needed
let parserModule: typeof import("../parsing/parser.js") | null = null;

async function getParser() {
  if (!parserModule) {
    parserModule = await import("../parsing/parser.js");
  }
  return parserModule;
}

if (parentPort) {
  parentPort.on("message", async (task: WorkerTask<ParseTask>) => {
    try {
      const { CodeParser } = await getParser();
      const parser = new CodeParser();
      await parser.initialize();

      const results: ParseResultItem[] = [];

      for (const file of task.payload.files) {
        try {
          const parsed = await parser.parseSource(
            file.content,
            file.language as never,
            file.path,
          );
          results.push({
            filePath: file.path,
            symbols: parsed.symbols as unknown[],
            imports: parsed.imports as unknown[],
            calls: parsed.calls as unknown[],
            heritage: parsed.heritage as unknown[],
            errors: parsed.errors,
          });
        } catch (err) {
          results.push({
            filePath: file.path,
            symbols: [],
            imports: [],
            calls: [],
            heritage: [],
            errors: [err instanceof Error ? err.message : String(err)],
          });
        }
      }

      const response: WorkerResult<ParseResultItem[]> = {
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
