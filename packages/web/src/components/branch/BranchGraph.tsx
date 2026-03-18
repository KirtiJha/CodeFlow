import { useRef, useEffect, useMemo } from "react";
import type { BranchInfo, BranchConflict } from "@/types/branch";
import { getSeverityColor } from "@/lib/color-system";

interface BranchGraphProps {
  branches: BranchInfo[];
  conflicts: BranchConflict[];
  selectedBranch?: string | null;
  onBranchClick?: (branch: string) => void;
  className?: string;
}

export function BranchGraph({
  branches,
  conflicts,
  selectedBranch,
  onBranchClick,
  className = "",
}: BranchGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    const centerX = 300;
    const centerY = 200;
    const radius = 150;

    branches.forEach((b, i) => {
      const angle = (2 * Math.PI * i) / branches.length - Math.PI / 2;
      map.set(b.name, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    return map;
  }, [branches]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio ?? 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, width, height);

    // Draw conflict edges
    for (const conflict of conflicts) {
      const p1 = positions.get(conflict.branch1);
      const p2 = positions.get(conflict.branch2);
      if (!p1 || !p2) continue;

      const colors = getSeverityColor(conflict.severity);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = colors.text;
      ctx.lineWidth =
        conflict.severity === "critical"
          ? 3
          : conflict.severity === "high"
            ? 2
            : 1;
      ctx.setLineDash(conflict.severity === "critical" ? [] : [8, 4]);
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }

    // Draw branch nodes
    for (const branch of branches) {
      const pos = positions.get(branch.name);
      if (!pos) continue;

      const isSelected = branch.name === selectedBranch;
      const isHEAD = branch.current;

      // Glow for selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isHEAD ? 10 : 8, 0, Math.PI * 2);
      ctx.fillStyle = isHEAD ? "#3b82f6" : isSelected ? "#3b82f6" : "#6b7280";
      ctx.fill();
      ctx.strokeStyle = "#2a2a3e";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = isSelected ? "#f0f0f5" : "#a0a0b8";
      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(branch.name, pos.x, pos.y + 22);
    }
  }, [branches, conflicts, positions, selectedBranch]);

  const handleClick = (e: React.MouseEvent) => {
    if (!canvasRef.current || !onBranchClick) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (const [name, pos] of positions) {
      const dx = x - pos.x;
      const dy = y - pos.y;
      if (dx * dx + dy * dy < 225) {
        onBranchClick(name);
        return;
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className={`h-full w-full cursor-pointer rounded-lg border border-border-default ${className}`}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
