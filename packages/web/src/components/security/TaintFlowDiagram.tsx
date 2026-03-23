import { useCallback, useMemo, useEffect, useRef, useState, memo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeProps,
  MarkerType,
  Position,
  Handle,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { TaintFlow, TaintSeverity } from "@/types/security";

/* ── Severity config ─────────────────────────────────────────── */
const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV_META: Record<string, { color: string; glow: string; bg: string; label: string }> = {
  critical: { color: "#ef4444", glow: "0 0 12px rgba(239,68,68,0.4)", bg: "rgba(239,68,68,0.08)", label: "Critical" },
  high:     { color: "#f97316", glow: "0 0 12px rgba(249,115,22,0.3)", bg: "rgba(249,115,22,0.08)", label: "High" },
  medium:   { color: "#f59e0b", glow: "0 0 12px rgba(245,158,11,0.25)", bg: "rgba(245,158,11,0.08)", label: "Medium" },
  low:      { color: "#10b981", glow: "0 0 12px rgba(16,185,129,0.2)", bg: "rgba(16,185,129,0.08)", label: "Low" },
};
function sev(s: string) { return SEV_META[s] ?? SEV_META.medium; }
function worstSev(sevs: string[]): string {
  let best = "low";
  for (const s of sevs) if ((SEV_ORDER[s] ?? 3) < (SEV_ORDER[best] ?? 3)) best = s;
  return best;
}

/* ── Category labels ─────────────────────────────────────────── */
const CAT_LABELS: Record<string, string> = {
  sql_injection: "SQL Injection", xss: "Cross-Site Scripting",
  command_injection: "Command Injection", path_traversal: "Path Traversal",
  ssrf: "SSRF", open_redirect: "Open Redirect", pii_leak: "PII Leak",
  hardcoded_secret: "Hardcoded Secret", missing_auth: "Missing Auth",
  insecure_deserialization: "Insecure Deser.", prototype_pollution: "Prototype Pollution",
  unsafe_regex: "Unsafe Regex",
};
function catLabel(c: string) { return CAT_LABELS[c] ?? c.replace(/_/g, " ").replace(/\b\w/g, (v) => v.toUpperCase()); }

/* ── Category icons (emoji for lightweight visual) ───────────── */
const CAT_ICONS: Record<string, string> = {
  sql_injection: "🗃️", xss: "🌐", command_injection: "⚡", path_traversal: "📂",
  ssrf: "🔗", open_redirect: "↗️", pii_leak: "👤", hardcoded_secret: "🔑",
  missing_auth: "🔓", insecure_deserialization: "📦", prototype_pollution: "🧬",
  unsafe_regex: "⚠️",
};

/* ══════════════════════════════════════════════════════════════════
   Custom Node: File Node (left column)
   Shows file path, finding count, severity breakdown bar
   ══════════════════════════════════════════════════════════════════ */
const FileNode = memo(({ data }: NodeProps) => {
  const d = data as {
    file: string; count: number; sevCounts: Record<string, number>;
    worstSev: string; highlighted: boolean; dimmed: boolean;
    categories: string[];
  };
  const sc = sev(d.worstSev);
  const total = d.count;
  // Severity bar segments
  const segments = (["critical", "high", "medium", "low"] as const)
    .filter((s) => (d.sevCounts[s] ?? 0) > 0)
    .map((s) => ({ sev: s, count: d.sevCounts[s]!, pct: ((d.sevCounts[s]! / total) * 100) }));
  // Shorten file path
  const parts = d.file.split("/");
  const shortFile = parts.length > 3
    ? `…/${parts.slice(-2).join("/")}`
    : d.file;

  return (
    <div
      style={{
        background: d.highlighted ? "rgba(59,130,246,0.1)" : "rgba(14,14,24,0.95)",
        border: `1px solid ${d.highlighted ? "#3b82f6" : "#1e1e36"}`,
        borderRadius: 10,
        padding: "10px 14px",
        width: 220,
        opacity: d.dimmed ? 0.25 : 1,
        transition: "all 0.2s ease",
        boxShadow: d.highlighted ? "0 0 16px rgba(59,130,246,0.15)" : "none",
      }}
    >
      <Handle type="source" position={Position.Right} style={{ background: "#3b82f6", width: 6, height: 6, border: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12 }}>📄</span>
        <span style={{
          fontSize: 11, fontFamily: "JetBrains Mono, monospace",
          color: d.highlighted ? "#93c5fd" : "#a0a0c0",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
        }}>
          {shortFile}
        </span>
      </div>
      {/* Severity bar */}
      <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
        {segments.map((seg) => (
          <div key={seg.sev} style={{ width: `${seg.pct}%`, background: sev(seg.sev).color, minWidth: 3 }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#888" }}>
          {d.categories.map((c) => CAT_ICONS[c] ?? "•").join(" ")}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: sc.color,
          background: sc.bg, padding: "1px 6px", borderRadius: 4,
        }}>
          {total} issue{total !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
});
FileNode.displayName = "FileNode";

/* ══════════════════════════════════════════════════════════════════
   Custom Node: Category Hub (center column)
   Large badge with category name, finding count, severity ring
   ══════════════════════════════════════════════════════════════════ */
const CategoryNode = memo(({ data }: NodeProps) => {
  const d = data as {
    category: string; count: number; worstSev: string;
    sevCounts: Record<string, number>; highlighted: boolean; dimmed: boolean;
    fileCount: number;
  };
  const sc = sev(d.worstSev);
  const icon = CAT_ICONS[d.category] ?? "🛡️";

  // SVG ring showing severity distribution
  const total = d.count;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const segments: { offset: number; length: number; color: string }[] = [];
  let cumulative = 0;
  for (const s of ["critical", "high", "medium", "low"] as const) {
    const cnt = d.sevCounts[s] ?? 0;
    if (cnt > 0) {
      const pct = cnt / total;
      segments.push({ offset: cumulative * circumference, length: pct * circumference, color: sev(s).color });
      cumulative += pct;
    }
  }

  return (
    <div
      style={{
        background: d.highlighted ? sc.bg : "rgba(14,14,24,0.95)",
        border: `1.5px solid ${d.highlighted ? sc.color : "#1e1e36"}`,
        borderRadius: 14,
        padding: "14px 16px",
        width: 170,
        textAlign: "center",
        opacity: d.dimmed ? 0.2 : 1,
        transition: "all 0.2s ease",
        boxShadow: d.highlighted ? sc.glow : "none",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: sc.color, width: 6, height: 6, border: "none" }} />
      <Handle type="source" position={Position.Right} style={{ background: sc.color, width: 6, height: 6, border: "none" }} />
      {/* Severity ring */}
      <div style={{ position: "relative", width: 84, height: 84, margin: "0 auto 8px" }}>
        <svg width="84" height="84" viewBox="0 0 84 84">
          <circle cx="42" cy="42" r={radius} fill="none" stroke="#1a1a2e" strokeWidth="4" />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx="42" cy="42" r={radius} fill="none"
              stroke={seg.color} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${seg.length} ${circumference - seg.length}`}
              strokeDashoffset={-seg.offset}
              transform="rotate(-90 42 42)"
            />
          ))}
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 22 }}>{icon}</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: sc.color }}>{d.count}</span>
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#e0e0f0", marginBottom: 3 }}>
        {catLabel(d.category)}
      </div>
      <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.03em" }}>
        {d.fileCount} file{d.fileCount !== 1 ? "s" : ""} affected
      </div>
    </div>
  );
});
CategoryNode.displayName = "CategoryNode";

/* ══════════════════════════════════════════════════════════════════
   Custom Node: Severity Summary (right side, stats)
   ══════════════════════════════════════════════════════════════════ */
const SeveritySummaryNode = memo(({ data }: NodeProps) => {
  const d = data as {
    totalFindings: number; sevCounts: Record<string, number>;
    score: number; grade: string;
  };
  const g = d.score >= 90 ? "#10b981" : d.score >= 75 ? "#3b82f6" : d.score >= 60 ? "#f59e0b" : d.score >= 40 ? "#f97316" : "#ef4444";
  const circumference = 2 * Math.PI * 30;
  const offset = circumference - (d.score / 100) * circumference;

  return (
    <div
      style={{
        background: "rgba(14,14,24,0.95)", border: "1px solid #1e1e36",
        borderRadius: 14, padding: "16px 20px", width: 160, textAlign: "center",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#555", width: 6, height: 6, border: "none" }} />
      <div style={{ position: "relative", width: 68, height: 68, margin: "0 auto 10px" }}>
        <svg width="68" height="68" viewBox="0 0 68 68">
          <circle cx="34" cy="34" r="30" fill="none" stroke="#1a1a2e" strokeWidth="4" />
          <circle
            cx="34" cy="34" r="30" fill="none"
            stroke={g} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 34 34)"
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: g }}>{d.grade}</span>
          <span style={{ fontSize: 9, color: "#888" }}>{d.score}/100</span>
        </div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#e0e0f0", marginBottom: 8 }}>
        {d.totalFindings} Total Findings
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {(["critical", "high", "medium", "low"] as const).map((s) => {
          const cnt = d.sevCounts[s] ?? 0;
          if (cnt === 0) return null;
          const sc = sev(s);
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: sc.color }} />
                <span style={{ color: "#aaa" }}>{sc.label}</span>
              </div>
              <span style={{ fontWeight: 700, color: sc.color }}>{cnt}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
SeveritySummaryNode.displayName = "SeveritySummaryNode";

/* ── Custom node types registry ──────────────────────────────── */
const nodeTypes = {
  fileNode: FileNode,
  categoryNode: CategoryNode,
  summaryNode: SeveritySummaryNode,
};

/* ══════════════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════════════ */
interface TaintFlowDiagramProps {
  flows: TaintFlow[];
  selectedFlowId?: string | null;
  onFlowSelect?: (flow: TaintFlow) => void;
  className?: string;
  score?: number;
  grade?: string;
}

export function TaintFlowDiagram({
  flows,
  selectedFlowId,
  onFlowSelect,
  className = "",
  score: overallScore,
  grade: overallGrade,
}: TaintFlowDiagramProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasSize, setHasSize] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) { setHasSize(true); observer.disconnect(); }
    };
    const observer = new ResizeObserver(check);
    check();
    if (!hasSize) observer.observe(el);
    return () => observer.disconnect();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Build the threat architecture graph ──────────────────── */
  const { nodes, edges, fileToCategories } = useMemo(() => {
    if (flows.length === 0) return { nodes: [], edges: [], fileToCategories: new Map<string, Set<string>>() };

    /* 1. Aggregate by file and by category */
    const byFile = new Map<string, { flows: TaintFlow[]; sevs: string[]; cats: Set<string> }>();
    const byCat = new Map<string, { flows: TaintFlow[]; files: Set<string>; sevs: string[] }>();

    for (const f of flows) {
      const file = f.sink?.file || f.source?.file || "unknown";
      if (!byFile.has(file)) byFile.set(file, { flows: [], sevs: [], cats: new Set() });
      const fg = byFile.get(file)!;
      fg.flows.push(f);
      fg.sevs.push(f.severity);
      fg.cats.add(f.category);

      if (!byCat.has(f.category)) byCat.set(f.category, { flows: [], files: new Set(), sevs: [] });
      const cg = byCat.get(f.category)!;
      cg.flows.push(f);
      cg.files.add(file);
      cg.sevs.push(f.severity);
    }

    const f2c = new Map<string, Set<string>>();
    for (const [file, fg] of byFile) f2c.set(file, fg.cats);

    /* 2. Determine which nodes are "active" (connected to selection) */
    const selectedFlow = flows.find((f) => f.id === selectedFlowId);
    const activeFile = selectedFlow ? (selectedFlow.sink?.file || selectedFlow.source?.file) : null;
    const activeCat = selectedFlow?.category ?? null;
    const hasSelection = !!selectedFlow;
    const hoveredFile = hoveredNodeId?.startsWith("file-") ? hoveredNodeId.slice(5) : null;
    const hoveredCat = hoveredNodeId?.startsWith("cat-") ? hoveredNodeId.slice(4) : null;
    const focusFile = activeFile || hoveredFile;
    const focusCat = activeCat || hoveredCat;

    /* 3. Sort categories by severity and count */
    const sortedCats = [...byCat.entries()].sort((a, b) => {
      const aSev = SEV_ORDER[worstSev(a[1].sevs)] ?? 3;
      const bSev = SEV_ORDER[worstSev(b[1].sevs)] ?? 3;
      if (aSev !== bSev) return aSev - bSev;
      return b[1].flows.length - a[1].flows.length;
    });

    /* Sort files by worst severity then count */
    const sortedFiles = [...byFile.entries()].sort((a, b) => {
      const aSev = SEV_ORDER[worstSev(a[1].sevs)] ?? 3;
      const bSev = SEV_ORDER[worstSev(b[1].sevs)] ?? 3;
      if (aSev !== bSev) return aSev - bSev;
      return b[1].flows.length - a[1].flows.length;
    });

    /* 4. Layout constants */
    const FILE_COL_X = 40;
    const CAT_COL_X = 360;
    const SUMMARY_X = 630;
    const FILE_H = 76;
    const FILE_GAP = 12;
    const CAT_H = 155;
    const CAT_GAP = 20;

    /* 5. Build nodes */
    const nodeList: Node[] = [];
    const edgeList: Edge[] = [];

    // Center vertically: find total height of taller column
    const totalFileH = sortedFiles.length * (FILE_H + FILE_GAP) - FILE_GAP;
    const totalCatH = sortedCats.length * (CAT_H + CAT_GAP) - CAT_GAP;
    const maxH = Math.max(totalFileH, totalCatH, 300);
    const fileStartY = (maxH - totalFileH) / 2;
    const catStartY = (maxH - totalCatH) / 2;

    // File nodes
    sortedFiles.forEach(([file, fg], idx) => {
      const sevCounts: Record<string, number> = {};
      for (const s of fg.sevs) sevCounts[s] = (sevCounts[s] ?? 0) + 1;

      const isConnected = focusCat ? fg.cats.has(focusCat) : focusFile === file;
      const isDimmed = (hasSelection || hoveredNodeId) && !isConnected && focusFile !== file;

      nodeList.push({
        id: `file-${file}`,
        type: "fileNode",
        position: { x: FILE_COL_X, y: fileStartY + idx * (FILE_H + FILE_GAP) },
        data: {
          file,
          count: fg.flows.length,
          sevCounts,
          worstSev: worstSev(fg.sevs),
          categories: [...fg.cats],
          highlighted: isConnected || focusFile === file,
          dimmed: isDimmed,
        },
      });
    });

    // Category nodes
    sortedCats.forEach(([cat, cg], idx) => {
      const sevCounts: Record<string, number> = {};
      for (const s of cg.sevs) sevCounts[s] = (sevCounts[s] ?? 0) + 1;

      const isConnected = focusFile ? cg.files.has(focusFile) : focusCat === cat;
      const isDimmed = (hasSelection || hoveredNodeId) && !isConnected && focusCat !== cat;

      nodeList.push({
        id: `cat-${cat}`,
        type: "categoryNode",
        position: { x: CAT_COL_X, y: catStartY + idx * (CAT_H + CAT_GAP) },
        data: {
          category: cat,
          count: cg.flows.length,
          worstSev: worstSev(cg.sevs),
          sevCounts,
          fileCount: cg.files.size,
          highlighted: isConnected || focusCat === cat,
          dimmed: isDimmed,
        },
      });
    });

    // Summary node (centered)
    const totalSevCounts: Record<string, number> = {};
    for (const f of flows) totalSevCounts[f.severity] = (totalSevCounts[f.severity] ?? 0) + 1;

    nodeList.push({
      id: "summary",
      type: "summaryNode",
      position: { x: SUMMARY_X, y: maxH / 2 - 100 },
      data: {
        totalFindings: flows.length,
        sevCounts: totalSevCounts,
        score: overallScore ?? 0,
        grade: overallGrade ?? "?",
      },
    });

    /* 6. Build edges: file → category for each connection */
    for (const [file, fg] of byFile) {
      for (const cat of fg.cats) {
        const catFlows = fg.flows.filter((f) => f.category === cat);
        const ws = worstSev(catFlows.map((f) => f.severity));
        const sc = sev(ws);
        const cnt = catFlows.length;

        const isActive =
          (focusFile === file && (!focusCat || focusCat === cat)) ||
          (focusCat === cat && (!focusFile || focusFile === file));
        const isDimmed = (hasSelection || hoveredNodeId) && !isActive;

        edgeList.push({
          id: `e-${file}-${cat}`,
          source: `file-${file}`,
          target: `cat-${cat}`,
          type: "smoothstep",
          animated: isActive,
          style: {
            stroke: isActive ? sc.color : "#333350",
            strokeWidth: isActive ? Math.min(cnt + 1, 4) : Math.min(cnt * 0.5 + 0.5, 2.5),
            opacity: isDimmed ? 0.08 : isActive ? 0.9 : 0.3,
            transition: "all 0.2s ease",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isActive ? sc.color : "#333350",
            width: 10,
            height: 10,
          },
          label: cnt > 1 ? `${cnt}` : undefined,
          labelStyle: { fill: isActive ? sc.color : "#555", fontSize: "9px", fontWeight: 700 },
          labelBgStyle: { fill: "#0e0e18", fillOpacity: 0.9 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
        });
      }
    }

    // Edges from categories → summary (faint)
    for (const [cat] of sortedCats) {
      const isActive = focusCat === cat;
      edgeList.push({
        id: `e-${cat}-summary`,
        source: `cat-${cat}`,
        target: "summary",
        type: "smoothstep",
        style: {
          stroke: isActive ? "#555" : "#1e1e36",
          strokeWidth: 1,
          opacity: isActive ? 0.5 : 0.15,
          strokeDasharray: "3 3",
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#1e1e36", width: 6, height: 6 },
      });
    }

    return { nodes: nodeList, edges: edgeList, fileToCategories: f2c };
  }, [flows, selectedFlowId, hoveredNodeId, overallScore, overallGrade]);

  /* ── Interaction handlers ──────────────────────────────────── */
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id === "summary") return;

      // If it's a file node, select the first flow in that file
      if (node.id.startsWith("file-")) {
        const file = node.id.slice(5);
        const flow = flows.find((f) => (f.sink?.file || f.source?.file) === file);
        if (flow) onFlowSelect?.(flow);
        return;
      }
      // If it's a category node, select the first flow in that category
      if (node.id.startsWith("cat-")) {
        const cat = node.id.slice(4);
        const flow = flows.find((f) => f.category === cat);
        if (flow) onFlowSelect?.(flow);
      }
    },
    [flows, onFlowSelect],
  );

  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  if (flows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No security findings to visualize
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`h-full w-full ${className}`}
      style={{ minHeight: 300 }}
    >
      {hasSize && (
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background color="#15152a" gap={24} size={1} />
        <Controls
          position="bottom-left"
          style={{
            background: "#0e0e18",
            border: "1px solid #2a2a3e",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        />
      </ReactFlow>
      )}
    </div>
  );
}
