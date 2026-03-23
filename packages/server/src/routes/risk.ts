import { Hono } from "hono";
import { openDatabase } from "@codeflow/core/storage";
import { InMemoryGraph } from "@codeflow/core/graph/knowledge-graph";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import { RiskScorer, CouplingCalculator } from "@codeflow/core/metrics";
import type { RiskScore, RiskFactor } from "@codeflow/core/metrics";
import type { ComplexityResult } from "@codeflow/core/metrics";
import type { CouplingResult } from "@codeflow/core/metrics";
import type { GraphNode } from "@codeflow/core/graph/types";
import type { AppEnv } from "../types.js";

export const riskRoutes = new Hono<AppEnv>();

/* ── Helpers ──────────────────────────────────────────────────── */

/** Convert `Map<string, RiskFactor>` → JSON-friendly array */
function serializeFactors(factors: Map<string, RiskFactor>) {
  return [...factors.entries()].map(([name, f]) => ({
    name,
    score: f.score,
    weight: f.weight,
    description: f.detail,
  }));
}

/** Build a ComplexityResult from stored node data */
function nodeComplexity(node: GraphNode): ComplexityResult | undefined {
  if (node.complexityCyclomatic == null && node.complexityCognitive == null) return undefined;
  return {
    cyclomatic: node.complexityCyclomatic ?? 1,
    cognitive: node.complexityCognitive ?? 0,
    halsteadVolume: 0,
    linesOfCode: (node.endLine ?? 0) - (node.startLine ?? 0) + 1,
  };
}

/** Build graph + stores from DB */
function buildGraph(dbPath: string) {
  const db = openDatabase({ path: dbPath });
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);
  const graph = new InMemoryGraph();
  for (const n of nodeStore.getAll()) graph.addNode(n);
  for (const e of edgeStore.getAll()) graph.addEdge(e);
  return { db, nodeStore, edgeStore, graph };
}

/** Score a single function node with all available data */
function scoreNode(
  fn: GraphNode,
  graph: InstanceType<typeof InMemoryGraph>,
  scorer: RiskScorer,
  couplingCalc: CouplingCalculator,
) {
  const complexity = nodeComplexity(fn);
  const coupling = couplingCalc.computeForNode(fn.id, graph);
  const result = scorer.score(fn.id, graph, complexity, coupling);
  return result;
}

/* ── POST /risk/score ─────────────────────────────────────────── */

riskRoutes.post("/risk/score", async (c) => {
  const body = await c.req.json();
  const { target } = body;
  const dbPath = c.get("dbPath");
  const { graph, nodeStore } = buildGraph(dbPath);
  const scorer = new RiskScorer();
  const couplingCalc = new CouplingCalculator();

  /* "overall" → aggregate across all functions */
  if (target === "overall") {
    const functions = [...graph.nodes.values()].filter(
      (n) => n.kind === "function" || n.kind === "method",
    );

    if (functions.length === 0) {
      return c.json({
        target: "overall",
        score: 0,
        level: "low",
        factors: [],
        recommendation: "No functions found to analyze",
        stats: { totalFunctions: 0, byLevel: {} },
      });
    }

    /* Score every function, collect aggregates */
    const scores: { node: GraphNode; result: RiskScore }[] = [];
    const factorTotals = new Map<string, { sum: number; count: number; weight: number }>();

    for (const fn of functions) {
      try {
        const result = scoreNode(fn, graph, scorer, couplingCalc);
        scores.push({ node: fn, result });
        for (const [name, f] of result.factors) {
          const prev = factorTotals.get(name) ?? { sum: 0, count: 0, weight: f.weight };
          prev.sum += f.score;
          prev.count += 1;
          factorTotals.set(name, prev);
        }
      } catch { /* skip */ }
    }

    /* Average factor scores */
    const avgFactors = [...factorTotals.entries()].map(([name, t]) => ({
      name,
      score: Math.round((t.sum / t.count) * 10) / 10,
      weight: t.weight,
      description: `Average across ${t.count} functions`,
    }));

    /* Distribution by level */
    const byLevel: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const { result } of scores) byLevel[result.level] = (byLevel[result.level] ?? 0) + 1;

    /* Weighted average score (weight high-risk functions more) */
    const totalScore = scores.reduce((acc, s) => acc + s.result.score, 0);
    const avgScore = Math.round(totalScore / scores.length);

    /* Top 3 worst factors */
    const sortedFactors = [...avgFactors].sort((a, b) => b.score * b.weight - a.score * a.weight);
    const worstFactorNames = sortedFactors.slice(0, 3).map((f) => f.name);

    const level = avgScore >= 75 ? "critical" : avgScore >= 50 ? "high" : avgScore >= 25 ? "medium" : "low";
    const recommendation =
      worstFactorNames.length > 0
        ? `Top risk areas: ${worstFactorNames.join(", ")}`
        : "Low overall risk";

    /* By-file aggregation */
    const byFile = new Map<string, { scores: number[]; worst: number; functions: number }>();
    for (const { node, result } of scores) {
      const file = node.filePath;
      const prev = byFile.get(file) ?? { scores: [], worst: 0, functions: 0 };
      prev.scores.push(result.score);
      prev.worst = Math.max(prev.worst, result.score);
      prev.functions += 1;
      byFile.set(file, prev);
    }

    const fileRisks = [...byFile.entries()]
      .map(([file, data]) => ({
        file,
        avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        maxScore: data.worst,
        functionCount: data.functions,
        level: data.worst >= 75 ? "critical" : data.worst >= 50 ? "high" : data.worst >= 25 ? "medium" : "low",
      }))
      .sort((a, b) => b.maxScore - a.maxScore);

    return c.json({
      target: "overall",
      score: avgScore,
      level,
      factors: avgFactors,
      recommendation,
      stats: {
        totalFunctions: scores.length,
        byLevel,
      },
      fileRisks: fileRisks.slice(0, 30),
    });
  }

  /* Specific symbol lookup */
  if (target) {
    const nodes = nodeStore.findByName(target);
    if (nodes.length === 0) {
      return c.json({ error: "Symbol not found" }, 404);
    }
    const node = nodes[0]!;
    const result = scoreNode(node, graph, scorer, couplingCalc);
    return c.json({
      target,
      score: result.score,
      level: result.level,
      factors: serializeFactors(result.factors),
      recommendation: result.recommendation,
    });
  }

  return c.json({ error: "target required" }, 400);
});

/* ── GET /risk/hotspots ───────────────────────────────────────── */

riskRoutes.get("/risk/hotspots", async (c) => {
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const dbPath = c.get("dbPath");
  const { graph } = buildGraph(dbPath);
  const scorer = new RiskScorer();
  const couplingCalc = new CouplingCalculator();

  const functions = [...graph.nodes.values()].filter(
    (n) => n.kind === "function" || n.kind === "method",
  );

  const scored = functions
    .map((fn) => {
      try {
        const result = scoreNode(fn, graph, scorer, couplingCalc);
        return {
          name: fn.qualifiedName ?? fn.name,
          file: fn.filePath,
          line: fn.startLine,
          score: result.score,
          level: result.level,
          factors: serializeFactors(result.factors),
          recommendation: result.recommendation,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
    .slice(0, limit);

  return c.json({ hotspots: scored });
});
