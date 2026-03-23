import { useCallback, useMemo, useState, memo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SchemaModel, SchemaReference } from "@/types/api";

/* ── Color palettes for directory-based grouping ───────────────── */

const GROUP_PALETTES = [
  { dot: "#818cf8" }, // indigo
  { dot: "#60a5fa" }, // blue
  { dot: "#a78bfa" }, // purple
  { dot: "#22d3ee" }, // cyan
  { dot: "#34d399" }, // green
  { dot: "#f472b6" }, // pink
  { dot: "#fbbf24" }, // amber
  { dot: "#f87171" }, // red
];

const EDGE_COLORS: Record<string, string> = {
  foreign_key: "#8b5cf6",
  has_many: "#f59e0b",
  belongs_to: "#3b82f6",
  reference: "#6366f1",
};

/** Left-border tint based on how many connections a model has */
function connectionTint(n: number): string {
  if (n >= 8) return "#ef4444";
  if (n >= 5) return "#8b5cf6";
  if (n >= 2) return "#3b82f6";
  if (n >= 1) return "#10b981";
  return "#2a2a3e";
}

/* ── Helpers ───────────────────────────────────────────────────── */

function shortName(full: string): string {
  const i = full.lastIndexOf("::");
  return i >= 0 ? full.slice(i + 2) : full;
}

function dirOf(file: string | undefined): string {
  if (!file) return "other";
  const parts = file.replace(/\\/g, "/").split("/");
  parts.pop();
  return parts.length >= 2
    ? parts.slice(-2).join("/")
    : parts[0] ?? "root";
}

/* ── Node data shape ───────────────────────────────────────────── */

interface ModelCardData {
  label: string;
  short: string;
  file: string;
  fields: { name: string; type: string; pk: boolean }[];
  fieldCount: number;
  conns: number;
  tint: string;
  selected: boolean;
  connected: boolean;
  dimmed: boolean;
}

/* ── Custom model card node ────────────────────────────────────── */

const ModelCard = memo(({ data }: NodeProps) => {
  const d = data as ModelCardData;
  const preview = d.fields.slice(0, 5);
  const extra = d.fieldCount - preview.length;

  return (
    <div
      className="transition-all duration-200"
      style={{
        opacity: d.dimmed ? 0.14 : 1,
        transform: d.dimmed ? "scale(0.96)" : "scale(1)",
        filter: d.dimmed ? "saturate(0.2)" : "none",
      }}
    >
      {/* Invisible handles for edge connections */}
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-3 !h-1" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-3 !h-1" />
      <Handle type="target" position={Position.Left} id="l" className="!opacity-0 !w-1 !h-3" />
      <Handle type="source" position={Position.Right} id="r" className="!opacity-0 !w-1 !h-3" />

      <div
        className={`
          rounded-lg overflow-hidden min-w-[200px] max-w-[224px]
          transition-shadow duration-300
          ${d.selected
            ? "ring-2 ring-accent-blue shadow-[0_0_24px_rgba(59,130,246,0.3)]"
            : d.connected
              ? "ring-1 ring-accent-purple/60 shadow-[0_0_16px_rgba(139,92,246,0.18)]"
              : "shadow-md shadow-black/30"
          }
        `}
        style={{
          borderLeft: `3px solid ${d.selected ? "#3b82f6" : d.connected ? "#8b5cf6" : d.tint}`,
        }}
      >
        {/* Header */}
        <div
          className={`px-3 py-2 flex items-center justify-between gap-2 ${
            d.selected
              ? "bg-accent-blue/10"
              : d.connected
                ? "bg-accent-purple/5"
                : "bg-bg-elevated"
          }`}
        >
          <div className="min-w-0">
            <div
              className="text-[11px] font-semibold text-text-primary truncate"
              title={d.label}
            >
              {d.short}
            </div>
            <div
              className="text-[9px] text-text-muted font-mono truncate mt-0.5"
              title={d.file}
            >
              {d.file?.split("/").slice(-2).join("/") ?? ""}
            </div>
          </div>
          {d.conns > 0 && (
            <span
              className="flex-shrink-0 flex items-center justify-center w-[20px] h-[20px] rounded-full text-[9px] font-bold"
              style={{
                background: d.selected
                  ? "rgba(59,130,246,0.15)"
                  : "rgba(255,255,255,0.06)",
                color: d.selected ? "#60a5fa" : d.tint,
              }}
            >
              {d.conns}
            </span>
          )}
        </div>

        {/* Fields — ER-diagram rows */}
        <div className="bg-bg-surface divide-y divide-border-subtle">
          {preview.map((f) => (
            <div
              key={f.name}
              className="flex items-center gap-1.5 px-3 py-[3px] text-[10px]"
            >
              {f.pk ? (
                <span className="flex-shrink-0 w-3 text-center text-[8px] text-accent-amber">
                  🔑
                </span>
              ) : (
                <span className="flex-shrink-0 w-3 text-center text-text-muted/30">
                  ─
                </span>
              )}
              <span className="font-mono text-text-primary truncate flex-1">
                {f.name}
              </span>
              <span
                className="text-text-muted/50 italic text-[9px] truncate max-w-[65px]"
                title={f.type}
              >
                {f.type === "unknown" ? "—" : f.type}
              </span>
            </div>
          ))}
          {extra > 0 && (
            <div className="px-3 py-[3px] text-[9px] text-text-muted text-center">
              +{extra} more
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 bg-bg-elevated/60 flex items-center justify-between text-[9px] text-text-muted">
          <span>{d.fieldCount} fields</span>
          {d.conns > 0 && (
            <span style={{ color: d.tint }}>{d.conns} connections</span>
          )}
        </div>
      </div>
    </div>
  );
});
ModelCard.displayName = "ModelCard";

/* ── Group header label (non-interactive) ──────────────────────── */

const GroupHeader = memo(({ data }: NodeProps) => {
  const d = data as { label: string; color: string; count: number };
  return (
    <div className="select-none pointer-events-none flex items-center gap-2">
      <div
        className="w-2 h-2 rounded-full"
        style={{ background: d.color }}
      />
      <span
        className="text-[11px] font-semibold tracking-wider uppercase"
        style={{ color: d.color }}
      >
        {d.label}
      </span>
      <span className="text-[10px] text-text-muted/60">{d.count}</span>
    </div>
  );
});
GroupHeader.displayName = "GroupHeader";

const nodeTypes = { modelCard: ModelCard, groupHeader: GroupHeader };

/* ── Main component ────────────────────────────────────────────── */

interface SchemaGraphProps {
  models: SchemaModel[];
  references: SchemaReference[];
  selectedModel?: string | null;
  onModelSelect?: (model: SchemaModel | null) => void;
  className?: string;
}

export function SchemaGraph({
  models,
  references,
  selectedModel,
  onModelSelect,
  className = "",
}: SchemaGraphProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  /* Pre-compute adjacency and connection counts */
  const { adjMap, connCount } = useMemo(() => {
    const adj = new Map<string, Set<string>>();
    const cnt = new Map<string, number>();
    for (const r of references) {
      if (!r.from || !r.to) continue;
      if (!adj.has(r.from)) adj.set(r.from, new Set());
      if (!adj.has(r.to)) adj.set(r.to, new Set());
      adj.get(r.from)!.add(r.to);
      adj.get(r.to)!.add(r.from);
      cnt.set(r.from, (cnt.get(r.from) ?? 0) + 1);
      cnt.set(r.to, (cnt.get(r.to) ?? 0) + 1);
    }
    return { adjMap: adj, connCount: cnt };
  }, [references]);

  // Active node = clicked (locked) or hovered (preview)
  const activeId = selectedModel ?? hovered;

  /* Build nodes & edges */
  const { nodes, edges } = useMemo(() => {
    /* ── Group models by source directory ── */
    const groups = new Map<string, SchemaModel[]>();
    for (const m of models) {
      const d = dirOf(m.file);
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(m);
    }
    // Largest groups first for better packing
    const sorted = [...groups.entries()].sort(
      (a, b) => b[1].length - a[1].length,
    );

    /* ── Grouped grid layout ── */
    const NW = 248;   // node width
    const NH = 175;   // estimated node height
    const GX = 28;    // horizontal gap between nodes
    const GY = 24;    // vertical gap between nodes
    const GGAP = 64;  // gap between groups
    const LBL = 32;   // group label height
    const MAX_ROW_W = 4200;

    let cx = 0;
    let cy = 0;
    let rowH = 0;

    const activeNeighbors = activeId
      ? adjMap.get(activeId) ?? new Set<string>()
      : new Set<string>();
    const hasActive = !!activeId;

    const nds: Node[] = [];

    for (let gi = 0; gi < sorted.length; gi++) {
      const [dir, gm] = sorted[gi];
      const pal = GROUP_PALETTES[gi % GROUP_PALETTES.length];

      const cols = Math.min(gm.length, 4);
      const rows = Math.ceil(gm.length / cols);
      const gw = cols * (NW + GX);
      const gh = LBL + rows * (NH + GY);

      // Wrap to next row if this group doesn't fit
      if (cx > 0 && cx + gw > MAX_ROW_W) {
        cx = 0;
        cy += rowH + GGAP;
        rowH = 0;
      }

      // Group label
      nds.push({
        id: `__grp_${dir}`,
        type: "groupHeader",
        position: { x: cx, y: cy },
        data: { label: dir, color: pal.dot, count: gm.length },
        selectable: false,
        draggable: false,
      });

      // Model cards within group
      for (let i = 0; i < gm.length; i++) {
        const m = gm[i];
        const c = i % cols;
        const r = Math.floor(i / cols);
        const isSel = m.name === selectedModel;
        const isConn = hasActive && activeNeighbors.has(m.name);
        const isDim = hasActive && m.name !== activeId && !isConn;
        const cc = connCount.get(m.name) ?? 0;

        nds.push({
          id: m.name,
          type: "modelCard",
          position: {
            x: cx + c * (NW + GX),
            y: cy + LBL + r * (NH + GY),
          },
          data: {
            label: m.name,
            short: shortName(m.name),
            file: m.file,
            fields: m.fields.map((f) => ({
              name: f.name,
              type: f.type,
              pk: f.primaryKey ?? false,
            })),
            fieldCount: m.fields.length,
            conns: cc,
            tint: connectionTint(cc),
            selected: isSel,
            connected: isConn,
            dimmed: isDim,
          },
        });
      }

      cx += gw + GGAP;
      rowH = Math.max(rowH, gh);
    }

    /* ── Edges — ONLY for the active (hovered/selected) node ── */
    const nameSet = new Set(models.map((m) => m.name));
    const eds: Edge[] = [];

    if (activeId) {
      let ei = 0;
      for (const ref of references) {
        if (!ref.from || !ref.to) continue;
        if (!nameSet.has(ref.from) || !nameSet.has(ref.to)) continue;
        if (ref.from !== activeId && ref.to !== activeId) continue;

        const kind = ref.type ?? "reference";
        const color = EDGE_COLORS[kind] ?? "#6366f1";

        eds.push({
          id: `e-${ei++}`,
          source: ref.from,
          target: ref.to,
          type: "smoothstep",
          label: ref.field ?? undefined,
          labelBgStyle: { fill: "#0a0a0f", fillOpacity: 0.95 },
          labelStyle: { fill: "#e0e0f0", fontSize: 10, fontWeight: 600 },
          style: { stroke: color, strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            width: 14,
            height: 14,
          },
          animated: true,
          zIndex: 1000,
        });
      }
    }

    return { nodes: nds, edges: eds };
  }, [models, references, selectedModel, activeId, adjMap, connCount]);

  /* ── Callbacks ── */

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "groupHeader") return;
      const model = models.find((m) => m.name === node.id);
      if (model) onModelSelect?.(model);
    },
    [models, onModelSelect],
  );

  const handlePaneClick = useCallback(() => {
    onModelSelect?.(null);
  }, [onModelSelect]);

  const handleMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type !== "groupHeader") setHovered(node.id);
    },
    [],
  );

  const handleMouseLeave = useCallback(() => setHovered(null), []);

  /* ── Render ── */

  if (!models.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No schema models found
      </div>
    );
  }

  const activeNeighborCount = activeId
    ? adjMap.get(activeId)?.size ?? 0
    : 0;

  return (
    <div className={`relative h-full w-full ${className}`}>
      {/* ── Legend bar ── */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-border-default bg-bg-surface/90 backdrop-blur-sm px-3 py-1.5 shadow-lg shadow-black/30">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Relationships
        </span>
        {Object.entries(EDGE_COLORS).map(([k, c]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div
              className="w-4 h-[2px] rounded-full"
              style={{ background: c }}
            />
            <span className="text-[10px] text-text-muted capitalize">
              {k.replace(/_/g, " ")}
            </span>
          </div>
        ))}
        <div className="h-3 w-px bg-border-default" />
        <span className="text-[9px] text-text-muted/70 italic">
          {activeId
            ? `${activeNeighborCount} connected model${activeNeighborCount !== 1 ? "s" : ""}`
            : "Hover or click a model to explore"}
        </span>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodeMouseEnter={handleMouseEnter}
        onNodeMouseLeave={handleMouseLeave}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.03}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background color="#1e1e30" gap={32} size={1} />
        <Controls
          className="schema-graph-controls"
          position="bottom-left"
          showInteractive={false}
        />
        <MiniMap
          className="schema-graph-minimap"
          position="bottom-right"
          nodeColor={(n) => {
            if (n.type === "groupHeader") return "transparent";
            const dd = n.data as ModelCardData;
            if (dd.selected) return "#3b82f6";
            if (dd.connected) return "#8b5cf6";
            return dd.tint ?? "#1a1a2e";
          }}
          maskColor="rgba(10,10,15,0.8)"
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Dark-theme overrides for ReactFlow controls & minimap */}
      <style>{`
        .schema-graph-controls {
          background: #12121c !important;
          border: 1px solid #2a2a3e !important;
          border-radius: 8px !important;
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.4);
        }
        .schema-graph-controls button {
          background: #12121c !important;
          border-bottom: 1px solid #2a2a3e !important;
          color: #a0a0c0 !important;
          fill: #a0a0c0 !important;
          width: 28px !important;
          height: 28px !important;
          padding: 4px !important;
        }
        .schema-graph-controls button:hover {
          background: #1e1e30 !important;
          color: #e0e0f0 !important;
          fill: #e0e0f0 !important;
        }
        .schema-graph-controls button svg {
          fill: currentColor !important;
          max-width: 16px !important;
          max-height: 16px !important;
        }
        .schema-graph-controls button:last-child {
          border-bottom: none !important;
        }
        .schema-graph-minimap {
          background: #0a0a0f !important;
          border: 1px solid #2a2a3e !important;
          border-radius: 8px !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.4);
        }
      `}</style>
    </div>
  );
}
