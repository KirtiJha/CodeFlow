import { useMemo } from "react";
import { motion } from "framer-motion";
import { getRiskColor } from "@/lib/color-system";
import { formatDate } from "@/lib/formatters";

interface RiskEntry {
  date: string;
  score: number;
}

interface RiskHistoryProps {
  entries: RiskEntry[];
  className?: string;
}

export function RiskHistory({ entries, className = "" }: RiskHistoryProps) {
  const svgWidth = 600;
  const svgHeight = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  const { path, areaPath, points, yLabels } = useMemo(() => {
    if (entries.length === 0)
      return { path: "", areaPath: "", points: [], yLabels: [] };

    const maxScore = Math.max(...entries.map((e) => e.score), 100);
    const step = chartWidth / Math.max(entries.length - 1, 1);

    const pts = entries.map((entry, i) => ({
      x: padding.left + i * step,
      y: padding.top + chartHeight - (entry.score / maxScore) * chartHeight,
      score: entry.score,
      date: entry.date,
    }));

    const lineSeg = pts.map((p) => `${p.x},${p.y}`).join(" L ");
    const line = `M ${lineSeg}`;

    const area = `${line} L ${pts[pts.length - 1].x},${padding.top + chartHeight} L ${pts[0].x},${padding.top + chartHeight} Z`;

    const labels = [0, 25, 50, 75, 100].map((v) => ({
      value: v,
      y: padding.top + chartHeight - (v / maxScore) * chartHeight,
    }));

    return { path: line, areaPath: area, points: pts, yLabels: labels };
  }, [entries, chartWidth, chartHeight]);

  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-text-muted">
        No risk history available
      </div>
    );
  }

  const lastEntry = entries[entries.length - 1];
  const prevEntry = entries.length >= 2 ? entries[entries.length - 2] : null;
  const change = prevEntry ? lastEntry.score - prevEntry.score : 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Risk Trend
        </h4>
        {change !== 0 && (
          <span
            className={`text-xs font-semibold ${
              change > 0 ? "text-accent-red" : "text-accent-green"
            }`}
          >
            {change > 0 ? "+" : ""}
            {change.toFixed(1)}
          </span>
        )}
      </div>

      {/* Chart */}
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {yLabels.map((l) => (
          <g key={l.value}>
            <line
              x1={padding.left}
              y1={l.y}
              x2={svgWidth - padding.right}
              y2={l.y}
              stroke="#1a1a2e"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 8}
              y={l.y + 4}
              textAnchor="end"
              fill="#6b7280"
              fontSize="10"
            >
              {l.value}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <motion.path
          d={areaPath}
          fill="url(#riskGradient)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 1 }}
        />

        {/* Line */}
        <motion.path
          d={path}
          fill="none"
          stroke={getRiskColor(lastEntry.score)}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />

        {/* Data points */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={getRiskColor(p.score)}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.05 }}
          />
        ))}

        {/* X-axis labels (every N entries to avoid overlap) */}
        {points
          .filter(
            (_, i) =>
              i % Math.max(1, Math.floor(points.length / 6)) === 0 ||
              i === points.length - 1,
          )
          .map((p) => (
            <text
              key={p.date}
              x={p.x}
              y={svgHeight - 5}
              textAnchor="middle"
              fill="#6b7280"
              fontSize="9"
            >
              {formatDate(p.date)}
            </text>
          ))}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={getRiskColor(lastEntry.score)}
              stopOpacity="0.4"
            />
            <stop
              offset="100%"
              stopColor={getRiskColor(lastEntry.score)}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
