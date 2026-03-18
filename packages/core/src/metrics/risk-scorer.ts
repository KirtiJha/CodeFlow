import type { KnowledgeGraph, GraphNode } from "../graph/types.js";
import type { ComplexityResult } from "./complexity.js";
import type { CouplingResult } from "./coupling.js";
import type { ChurnResult } from "./churn.js";
import type { TestLink } from "../tests/test-linker.js";
import type { SecurityScanResult } from "../taint/taint-types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("metrics:risk");

export interface RiskScore {
  score: number; // 0-100
  level: "low" | "medium" | "high" | "critical";
  factors: Map<string, RiskFactor>;
  recommendation: string;
}

export interface RiskFactor {
  score: number; // 0-10
  weight: number;
  detail: string;
}

const WEIGHTS = {
  complexity: 0.15,
  testCoverage: 0.25,
  dataSensitivity: 0.2,
  blastRadius: 0.15,
  changeVelocity: 0.1,
  errorHandling: 0.15,
};

/**
 * Composite risk scorer that combines multiple factors
 * into a single 0-100 risk score.
 */
export class RiskScorer {
  /**
   * Compute risk score for a function/method node.
   */
  score(
    nodeId: string,
    graph: KnowledgeGraph,
    complexity?: ComplexityResult,
    coupling?: CouplingResult,
    churn?: ChurnResult,
    testLinks?: TestLink[],
    security?: SecurityScanResult,
  ): RiskScore {
    const node = graph.getNode(nodeId);
    if (!node) {
      return {
        score: 0,
        level: "low",
        factors: new Map(),
        recommendation: "Node not found",
      };
    }

    const factors = new Map<string, RiskFactor>();

    // Factor 1: Complexity
    const complexityScore = this.scoreComplexity(complexity);
    factors.set("complexity", {
      score: complexityScore,
      weight: WEIGHTS.complexity,
      detail: complexity
        ? `Cyclomatic: ${complexity.cyclomatic}, Cognitive: ${complexity.cognitive}`
        : "No complexity data",
    });

    // Factor 2: Test Coverage (inverted — low coverage = high risk)
    const testScore = this.scoreTestCoverage(nodeId, testLinks, graph);
    factors.set("testCoverage", {
      score: testScore,
      weight: WEIGHTS.testCoverage,
      detail: testLinks
        ? `${testLinks.length} tests covering this code`
        : "No test coverage data",
    });

    // Factor 3: Data Sensitivity
    const sensitivityScore = this.scoreDataSensitivity(node, security);
    factors.set("dataSensitivity", {
      score: sensitivityScore,
      weight: WEIGHTS.dataSensitivity,
      detail:
        sensitivityScore > 5
          ? "Handles sensitive data"
          : "No sensitive data detected",
    });

    // Factor 4: Blast Radius
    const blastScore = this.scoreBlastRadius(nodeId, graph);
    factors.set("blastRadius", {
      score: blastScore,
      weight: WEIGHTS.blastRadius,
      detail: `${this.countTransitiveCallers(nodeId, graph)} transitive callers`,
    });

    // Factor 5: Change Velocity
    const velocityScore = this.scoreChangeVelocity(churn);
    factors.set("changeVelocity", {
      score: velocityScore,
      weight: WEIGHTS.changeVelocity,
      detail: churn
        ? `${churn.recentCommits} commits in last 30 days`
        : "No churn data",
    });

    // Factor 6: Error Handling
    const errorScore = this.scoreErrorHandling(node, complexity);
    factors.set("errorHandling", {
      score: errorScore,
      weight: WEIGHTS.errorHandling,
      detail:
        errorScore > 5
          ? "Potential error handling gaps"
          : "Adequate error handling",
    });

    // Weighted composite
    let total = 0;
    for (const [, factor] of factors) {
      total += factor.score * factor.weight;
    }
    const finalScore = Math.round(total * 10); // Scale to 0-100

    const level = this.scoreToLevel(finalScore);
    const recommendation = this.generateRecommendation(factors, level);

    return { score: finalScore, level, factors, recommendation };
  }

  /**
   * Score a set of changed files/nodes for overall risk.
   */
  scoreDiff(changedNodeIds: string[], graph: KnowledgeGraph): RiskScore {
    if (changedNodeIds.length === 0) {
      return {
        score: 0,
        level: "low",
        factors: new Map(),
        recommendation: "No changes detected",
      };
    }

    let maxScore = 0;
    let worstNode: RiskScore | null = null;

    for (const nodeId of changedNodeIds) {
      const nodeScore = this.score(nodeId, graph);
      if (nodeScore.score > maxScore) {
        maxScore = nodeScore.score;
        worstNode = nodeScore;
      }
    }

    return (
      worstNode ?? {
        score: 0,
        level: "low",
        factors: new Map(),
        recommendation: "No risk detected",
      }
    );
  }

  private scoreComplexity(complexity?: ComplexityResult): number {
    if (!complexity) return 5; // Unknown = medium risk
    const combined = complexity.cyclomatic + complexity.cognitive;
    if (combined > 50) return 10;
    if (combined > 30) return 8;
    if (combined > 15) return 6;
    if (combined > 8) return 4;
    return 2;
  }

  private scoreTestCoverage(
    nodeId: string,
    testLinks?: TestLink[],
    graph?: KnowledgeGraph,
  ): number {
    if (!testLinks) return 7; // No data = assume risky

    const directTests = testLinks.filter(
      (l) => l.productionNodeId === nodeId && l.linkType === "direct",
    ).length;
    const transitiveTests = testLinks.filter(
      (l) => l.productionNodeId === nodeId && l.linkType === "transitive",
    ).length;

    if (directTests >= 3) return 1;
    if (directTests >= 1) return 3;
    if (transitiveTests >= 2) return 5;
    if (transitiveTests >= 1) return 7;
    return 10; // No coverage = max risk
  }

  private scoreDataSensitivity(
    node: GraphNode,
    security?: SecurityScanResult,
  ): number {
    let score = 0;
    const name = node.name.toLowerCase();

    // Check name patterns
    if (/auth|login|password|token|session|credential/i.test(name)) score += 4;
    if (/payment|billing|credit|charge/i.test(name)) score += 5;
    if (/email|phone|ssn|address|pii/i.test(name)) score += 3;
    if (/encrypt|decrypt|hash|sign|verify/i.test(name)) score += 3;

    // Check security scan results
    if (security) {
      if (security.summary.critical > 0) score += 3;
      if (security.summary.warning > 0) score += 1;
    }

    return Math.min(10, score);
  }

  private scoreBlastRadius(nodeId: string, graph: KnowledgeGraph): number {
    const callerCount = this.countTransitiveCallers(nodeId, graph);
    if (callerCount > 100) return 10;
    if (callerCount > 50) return 8;
    if (callerCount > 20) return 6;
    if (callerCount > 5) return 4;
    if (callerCount > 0) return 2;
    return 0;
  }

  private scoreChangeVelocity(churn?: ChurnResult): number {
    if (!churn) return 5;
    const recent = churn.recentCommits;
    if (recent > 20) return 10;
    if (recent > 10) return 8;
    if (recent > 5) return 6;
    if (recent > 2) return 4;
    return 2;
  }

  private scoreErrorHandling(
    node: GraphNode,
    complexity?: ComplexityResult,
  ): number {
    // Heuristic: high complexity with no 'catch/try/error' in name = risky
    const cc = complexity?.cyclomatic ?? 1;
    if (cc > 10) return 7;
    if (cc > 5) return 4;
    return 2;
  }

  private countTransitiveCallers(
    nodeId: string,
    graph: KnowledgeGraph,
  ): number {
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const callers = graph.getIncomingEdges(current, "calls");
      for (const edge of callers) {
        if (!visited.has(edge.sourceId)) {
          queue.push(edge.sourceId);
        }
      }
    }

    return visited.size - 1; // Exclude self
  }

  private scoreToLevel(score: number): "low" | "medium" | "high" | "critical" {
    if (score >= 75) return "critical";
    if (score >= 50) return "high";
    if (score >= 25) return "medium";
    return "low";
  }

  private generateRecommendation(
    factors: Map<string, RiskFactor>,
    level: string,
  ): string {
    const recommendations: string[] = [];

    const testCoverage = factors.get("testCoverage");
    if (testCoverage && testCoverage.score >= 7) {
      recommendations.push("Add test coverage for this code");
    }

    const complexity = factors.get("complexity");
    if (complexity && complexity.score >= 7) {
      recommendations.push("Consider refactoring to reduce complexity");
    }

    const sensitivity = factors.get("dataSensitivity");
    if (sensitivity && sensitivity.score >= 7) {
      recommendations.push(
        "Ensure security review for sensitive data handling",
      );
    }

    const blast = factors.get("blastRadius");
    if (blast && blast.score >= 7) {
      recommendations.push(
        "High blast radius — consider adding integration tests",
      );
    }

    if (recommendations.length === 0) {
      return level === "low"
        ? "Low risk — no action needed"
        : "Review before merging";
    }

    return recommendations.join("; ");
  }
}
