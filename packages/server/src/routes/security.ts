import { Hono } from "hono";
import { openDatabase, initializeSchema } from "@codeflow/core/storage";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import { DFGStore } from "@codeflow/core/storage/dfg-store";
import {
  SourceRegistry,
  SinkRegistry,
  SanitizerRegistry,
  TaintEngine,
} from "@codeflow/core/taint";
import type { GraphNode, GraphEdge } from "@codeflow/core";
import type { DataFlowGraph, DFGNode, DFGEdge } from "@codeflow/core";
import type { AppEnv } from "../types.js";
import { scanFiles, type ScanFinding } from "../security/file-scanner.js";
import { isSemgrepAvailable, runSemgrep, type SemgrepFinding } from "../security/semgrep.js";

/* ── Shared types ────────────────────────────────────────────── */

type Severity = "critical" | "high" | "medium" | "low";

interface Finding {
  id: string;
  severity: Severity;
  category: string;
  description: string;
  fix: string;
  source: LocationInfo;
  sink: LocationInfo;
  path: LocationInfo[];
  scanner: "file" | "dfg" | "semgrep" | "graph";
}

interface LocationInfo {
  file: string;
  line: number;
  column: number;
  name: string;
  kind: string;
  symbol: string;
}

/* ── DFG-based taint scanner ─────────────────────────────────── */

function scanDFG(db: ReturnType<typeof openDatabase>, repoId: string): Finding[] {
  const findings: Finding[] = [];
  const dfgStore = new DFGStore(db);

  // Load all DFG nodes and edges for this repo
  const allDfgNodes = dfgStore.getSources(repoId);
  if (allDfgNodes.length === 0) return findings;

  // Build DFG maps per function
  const functionIds = new Set(allDfgNodes.map((n) => n.functionId));
  const dfgMap = new Map<string, DataFlowGraph>();

  for (const funcId of functionIds) {
    const nodes = dfgStore.getNodesByFunction(funcId);
    const nodeMap = new Map<string, DFGNode>();
    for (const n of nodes) nodeMap.set(n.id, n);

    // Collect edges for these nodes
    const edges: DFGEdge[] = [];
    for (const n of nodes) {
      const outEdges = dfgStore.getEdgesBySource(n.id);
      edges.push(...outEdges);
    }

    dfgMap.set(funcId, {
      functionId: funcId,
      nodes: nodeMap,
      edges,
      sources: nodes.filter((n) => n.isSource).map((n) => n.id),
      sinks: nodes.filter((n) => n.isSink).map((n) => n.id),
      params: nodes.filter((n) => n.kind === "param").map((n) => n.id),
      returns: nodes.filter((n) => n.kind === "return").map((n) => n.id),
    });
  }

  if (dfgMap.size === 0) return findings;

  // Run taint engine on the DFGs
  const engine = new TaintEngine(
    new SourceRegistry(),
    new SinkRegistry(),
    new SanitizerRegistry(),
  );

  const result = engine.scan(dfgMap, repoId);

  // Convert TaintFlow[] → Finding[]
  let id = 1;
  for (const flow of result.flows) {
    const severity: Severity = flow.severity === "critical" ? "critical"
      : flow.severity === "warning" ? "high"
      : "medium";

    findings.push({
      id: `dfg-${id++}`,
      severity,
      category: flow.category,
      description: `Taint flow: ${flow.path[0]?.code ?? "source"} → ${flow.path[flow.path.length - 1]?.code ?? "sink"} (${flow.path.length} steps)${flow.isSanitized ? " [sanitized]" : ""}`,
      fix: flow.fixSuggestion ?? "Review and validate untrusted input",
      source: {
        file: flow.path[0]?.filePath ?? "",
        line: flow.path[0]?.line ?? 0,
        column: 0,
        name: flow.path[0]?.code ?? "",
        kind: "dfg_source",
        symbol: flow.path[0]?.code ?? "",
      },
      sink: {
        file: flow.path[flow.path.length - 1]?.filePath ?? "",
        line: flow.path[flow.path.length - 1]?.line ?? 0,
        column: 0,
        name: flow.path[flow.path.length - 1]?.code ?? "",
        kind: "dfg_sink",
        symbol: flow.path[flow.path.length - 1]?.code ?? "",
      },
      path: flow.path.map((step) => ({
        file: step.filePath,
        line: step.line,
        column: 0,
        name: step.code,
        kind: step.isSanitizer ? "sanitizer" : "data_flow",
        symbol: step.code,
      })),
      scanner: "dfg",
    });
  }

  return findings;
}

/* ── Convert Semgrep findings → Finding[] ────────────────────── */

function convertSemgrepFindings(semFindings: SemgrepFinding[]): Finding[] {
  return semFindings.map((sf) => ({
    id: sf.id,
    severity: sf.severity,
    category: sf.category,
    description: `[Semgrep] ${sf.description}`,
    fix: sf.fix,
    source: {
      file: sf.file,
      line: sf.line,
      column: sf.column,
      name: sf.rule,
      kind: "semgrep",
      symbol: sf.code.slice(0, 80),
    },
    sink: {
      file: sf.file,
      line: sf.endLine,
      column: sf.endColumn,
      name: sf.rule,
      kind: "semgrep",
      symbol: sf.code.slice(0, 80),
    },
    path: [{
      file: sf.file,
      line: sf.line,
      column: sf.column,
      name: sf.rule,
      kind: "semgrep",
      symbol: sf.code.slice(0, 80),
    }],
    scanner: "semgrep" as const,
  }));
}

/* ── Convert file scan findings → Finding[] ──────────────────── */

function convertFileScanFindings(scanFindings: ScanFinding[]): Finding[] {
  return scanFindings.map((sf) => ({
    ...sf,
    scanner: "file" as const,
  }));
}

/* ── Dedup: same file+line+category → keep highest severity ──── */

function deduplicateFindings(allFindings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();
  const sevOrder: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };

  for (const f of allFindings) {
    const key = `${f.source.file}:${f.source.line}:${f.category}`;
    const existing = seen.get(key);
    if (!existing || (sevOrder[f.severity] ?? 0) > (sevOrder[existing.severity] ?? 0)) {
      seen.set(key, f);
    }
  }

  const result = [...seen.values()];
  result.sort((a, b) => (sevOrder[b.severity] ?? 0) - (sevOrder[a.severity] ?? 0));
  return result;
}

/* ── Score computation ───────────────────────────────────────── */

function computeScore(findings: Finding[], totalNodes: number) {
  const crit = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;
  const med = findings.filter((f) => f.severity === "medium").length;
  const low = findings.filter((f) => f.severity === "low").length;

  const penalty = crit * 20 + high * 8 + med * 3 + low * 1;
  const taintScore = Math.max(0, Math.min(100, 100 - penalty));

  const inputFindings = findings.filter((f) =>
    ["sql_injection", "xss", "command_injection", "insecure_deserialization"].includes(f.category),
  ).length;
  const inputValidation = Math.max(0, 100 - inputFindings * 12);

  const depFindings = findings.filter((f) =>
    ["hardcoded_secret", "ssrf", "dependency_risk"].includes(f.category),
  ).length;
  const dependencySafety = Math.max(0, 100 - depFindings * 15);

  const flowFindings = findings.filter((f) =>
    ["path_traversal", "open_redirect", "pii_leak", "log_injection"].includes(f.category),
  ).length;
  const dataFlowScore = Math.max(0, 100 - flowFindings * 10);

  const overall = Math.round(
    taintScore * 0.4 + inputValidation * 0.25 + dependencySafety * 0.2 + dataFlowScore * 0.15,
  );

  const grade = overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";

  return {
    score: overall,
    grade,
    overall,
    criticalCount: crit,
    highCount: high,
    mediumCount: med,
    lowCount: low,
    taintScore,
    inputValidation,
    dependencySafety,
    dataFlowScore,
    totalFlows: findings.length,
    resolvedCount: findings.filter((f) => f.severity === "low").length,
  };
}

/* ── Routes ──────────────────────────────────────────────────── */

export const securityRoutes = new Hono<AppEnv>();

/** Cache semgrep availability check */
let semgrepChecked = false;
let semgrepEnabled = false;

async function checkSemgrep(): Promise<boolean> {
  if (!semgrepChecked) {
    semgrepEnabled = await isSemgrepAvailable();
    semgrepChecked = true;
  }
  return semgrepEnabled;
}

/**
 * Run all security scanners and merge/deduplicate findings.
 */
async function runAllScanners(
  dbPath: string,
  repoPath: string,
): Promise<{ findings: Finding[]; scanners: string[] }> {
  const db = openDatabase({ path: dbPath });
  initializeSchema(db);

  const scanners: string[] = [];
  const allFindings: Finding[] = [];

  // 1. File-based line-level pattern scanner (always runs)
  try {
    const fileFindings = scanFiles(repoPath);
    allFindings.push(...convertFileScanFindings(fileFindings));
    scanners.push("file-scanner");
  } catch {
    // Non-critical
  }

  // 2. DFG-based taint analysis (uses pipeline results if available)
  try {
    const repoRow = db.prepare("SELECT id FROM repos LIMIT 1").get() as { id: string } | undefined;
    if (repoRow) {
      const dfgFindings = scanDFG(db, repoRow.id);
      allFindings.push(...dfgFindings);
      if (dfgFindings.length > 0) scanners.push("dfg-taint");
    }
  } catch {
    // DFG tables may not have data yet
  }

  // 3. Semgrep (if installed)
  try {
    const hasSemgrep = await checkSemgrep();
    if (hasSemgrep) {
      const semFindings = await runSemgrep(repoPath);
      allFindings.push(...convertSemgrepFindings(semFindings));
      if (semFindings.length > 0) scanners.push("semgrep");
    }
  } catch {
    // Semgrep not available or failed
  }

  const findings = deduplicateFindings(allFindings);
  return { findings, scanners };
}

securityRoutes.post("/security/scan", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { path: scanPath, severity } = body as { path?: string; severity?: string };

  const dbPath = c.get("dbPath");
  const repoPath = c.get("repoPath");
  let { findings, scanners } = await runAllScanners(dbPath, repoPath);

  // Filter by path
  if (scanPath) {
    findings = findings.filter(
      (f) => f.source.file.includes(scanPath) || f.sink.file.includes(scanPath),
    );
  }

  // Filter by minimum severity
  if (severity) {
    const order: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    const minLevel = order[severity] ?? 0;
    findings = findings.filter((f) => (order[f.severity] ?? 0) >= minLevel);
  }

  const score = computeScore(findings, 0);

  return c.json({
    data: { ...score, scanners },
    status: "ok",
  });
});

securityRoutes.get("/security/report", async (c) => {
  const dbPath = c.get("dbPath");
  const repoPath = c.get("repoPath");
  const { findings, scanners } = await runAllScanners(dbPath, repoPath);

  const byCategory: Record<string, number> = {};
  for (const f of findings) {
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
  }

  const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
  }

  return c.json({
    data: {
      totalFlows: findings.length,
      bySeverity,
      byCategory,
      flows: findings,
      scannedAt: new Date().toISOString(),
      scanners,
    },
    status: "ok",
  });
});

