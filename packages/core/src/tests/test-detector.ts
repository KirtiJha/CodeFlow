import type { KnowledgeGraph, GraphNode } from "../graph/types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("tests:detector");

export interface DetectedTest {
  nodeId: string;
  testName: string;
  suiteName?: string;
  filePath: string;
  framework: TestFramework;
  line: number;
}

export type TestFramework =
  | "jest"
  | "vitest"
  | "mocha"
  | "pytest"
  | "unittest"
  | "junit"
  | "go_test"
  | "rspec"
  | "phpunit";

const FRAMEWORK_PATTERNS: Array<{
  framework: TestFramework;
  filePatterns: RegExp[];
  namePatterns: RegExp[];
}> = [
  {
    framework: "jest",
    filePatterns: [/\.test\.[tj]sx?$/, /\.spec\.[tj]sx?$/, /__tests__\//],
    namePatterns: [/^(describe|it|test)\b/],
  },
  {
    framework: "vitest",
    filePatterns: [/\.test\.[tj]sx?$/, /\.spec\.[tj]sx?$/],
    namePatterns: [/^(describe|it|test)\b/],
  },
  {
    framework: "mocha",
    filePatterns: [/\.test\.[tj]sx?$/, /\.spec\.[tj]sx?$/],
    namePatterns: [/^(describe|it)\b/],
  },
  {
    framework: "pytest",
    filePatterns: [/test_\w+\.py$/, /\w+_test\.py$/, /tests?\//],
    namePatterns: [/^test_/],
  },
  {
    framework: "unittest",
    filePatterns: [/test_\w+\.py$/, /\w+_test\.py$/],
    namePatterns: [/^test_/, /^Test/],
  },
  {
    framework: "junit",
    filePatterns: [/Test\.java$/, /Tests\.java$/, /\w+Test\.java$/],
    namePatterns: [/^test/, /^should/],
  },
  {
    framework: "go_test",
    filePatterns: [/_test\.go$/],
    namePatterns: [/^Test/, /^Benchmark/],
  },
  {
    framework: "rspec",
    filePatterns: [/_spec\.rb$/, /spec\//],
    namePatterns: [/^(describe|it|context)\b/],
  },
  {
    framework: "phpunit",
    filePatterns: [/Test\.php$/, /Tests\.php$/],
    namePatterns: [/^test/],
  },
];

/**
 * Identifies test functions/methods in the knowledge graph.
 */
export class TestDetector {
  detect(graph: KnowledgeGraph): DetectedTest[] {
    const tests: DetectedTest[] = [];
    const callableKinds = new Set(["function", "method"]);

    for (const [, node] of graph.nodes) {
      if (!callableKinds.has(node.kind)) continue;

      const framework = this.detectFramework(node);
      if (!framework) continue;

      tests.push({
        nodeId: node.id,
        testName: node.name,
        suiteName: node.ownerId ? graph.getNode(node.ownerId)?.name : undefined,
        filePath: node.filePath,
        framework,
        line: node.startLine ?? 0,
      });
    }

    log.debug({ count: tests.length }, "Detected test functions");
    return tests;
  }

  private detectFramework(node: GraphNode): TestFramework | null {
    for (const fp of FRAMEWORK_PATTERNS) {
      // Check file pattern
      const fileMatch = fp.filePatterns.some((p) => p.test(node.filePath));
      if (!fileMatch) continue;

      // Check name pattern
      const nameMatch = fp.namePatterns.some((p) => p.test(node.name));
      if (nameMatch) return fp.framework;
    }

    // Fallback: check isTest annotation
    if (node.isTest) {
      return this.inferFrameworkFromFile(node.filePath);
    }

    return null;
  }

  private inferFrameworkFromFile(filePath: string): TestFramework | null {
    if (filePath.endsWith(".py")) return "pytest";
    if (filePath.endsWith(".java")) return "junit";
    if (filePath.endsWith(".go")) return "go_test";
    if (filePath.endsWith(".rb")) return "rspec";
    if (filePath.endsWith(".php")) return "phpunit";
    if (/\.[tj]sx?$/.test(filePath)) return "vitest";
    return null;
  }
}
