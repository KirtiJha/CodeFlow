import { useRef, useEffect, useState } from "react";
import Graph from "graphology";

interface GraphMinimapProps {
  graph: Graph | null;
  viewportX: number;
  viewportY: number;
  viewportRatio: number;
  onViewportChange?: (x: number, y: number) => void;
  className?: string;
}

export function GraphMinimap({
  graph,
  viewportX,
  viewportY,
  viewportRatio,
  onViewportChange,
  className = "",
}: GraphMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions] = useState({ width: 180, height: 120 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graph) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Compute bounds
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    graph.forEachNode((_node, attrs) => {
      minX = Math.min(minX, attrs.x ?? 0);
      minY = Math.min(minY, attrs.y ?? 0);
      maxX = Math.max(maxX, attrs.x ?? 0);
      maxY = Math.max(maxY, attrs.y ?? 0);
    });

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const padding = 10;
    const scaleX = (dimensions.width - padding * 2) / rangeX;
    const scaleY = (dimensions.height - padding * 2) / rangeY;
    const scale = Math.min(scaleX, scaleY);

    // Clear
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Draw edges
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 0.5;
    graph.forEachEdge((_edge, _attrs, source, target) => {
      const sourceAttrs = graph.getNodeAttributes(source);
      const targetAttrs = graph.getNodeAttributes(target);
      const sx = ((sourceAttrs.x ?? 0) - minX) * scale + padding;
      const sy = ((sourceAttrs.y ?? 0) - minY) * scale + padding;
      const tx = ((targetAttrs.x ?? 0) - minX) * scale + padding;
      const ty = ((targetAttrs.y ?? 0) - minY) * scale + padding;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    });

    // Draw nodes
    graph.forEachNode((_node, attrs) => {
      const x = ((attrs.x ?? 0) - minX) * scale + padding;
      const y = ((attrs.y ?? 0) - minY) * scale + padding;

      ctx.fillStyle = attrs.color ?? "#6b7280";
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw viewport
    const vw = (dimensions.width / viewportRatio) * 0.2;
    const vh = (dimensions.height / viewportRatio) * 0.2;
    const vx = viewportX * dimensions.width - vw / 2;
    const vy = viewportY * dimensions.height - vh / 2;

    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1;
    ctx.strokeRect(vx, vy, vw, vh);
  }, [graph, viewportX, viewportY, viewportRatio, dimensions]);

  const handleClick = (e: React.MouseEvent) => {
    if (!canvasRef.current || !onViewportChange) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / dimensions.width;
    const y = (e.clientY - rect.top) / dimensions.height;
    onViewportChange(x, y);
  };

  return (
    <div className={`glass overflow-hidden rounded-lg ${className}`}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleClick}
        className="cursor-crosshair"
      />
    </div>
  );
}
