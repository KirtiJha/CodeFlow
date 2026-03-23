import { defineConfig } from "tsup";
import { copyFileSync } from "node:fs";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/branches/index.ts",
    "src/git/index.ts",
    "src/graph/knowledge-graph.ts",
    "src/metrics/index.ts",
    "src/pipeline/index.ts",
    "src/schema/index.ts",
    "src/search/index.ts",
    "src/storage/index.ts",
    "src/storage/edge-store.ts",
    "src/storage/node-store.ts",
    "src/storage/dfg-store.ts",
    "src/dfg/index.ts",
    "src/utils/index.ts",
    "src/taint/index.ts",
    "src/tests/index.ts",
  ],
  format: ["esm"],
  dts: false,
  clean: true,
  sourcemap: true,
  target: "node22",
  splitting: true,
  onSuccess: async () => {
    // Copy non-TS assets that are loaded at runtime via __dirname
    copyFileSync("src/storage/schema.sql", "dist/schema.sql");
  },
  external: [
    "better-sqlite3",
    "tree-sitter",
    "tree-sitter-javascript",
    "tree-sitter-typescript",
    "tree-sitter-python",
    "tree-sitter-java",
    "tree-sitter-go",
    "tree-sitter-rust",
    "tree-sitter-c-sharp",
    "tree-sitter-kotlin",
    "tree-sitter-php",
    "tree-sitter-ruby",
    "tree-sitter-swift",
    "tree-sitter-c",
    "tree-sitter-cpp",
    "simple-git",
    "pino",
  ],
});
