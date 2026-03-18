import { motion } from "framer-motion";
import { getRiskColor } from "@/lib/color-system";

interface RiskGaugeProps {
  score: number;
  maxScore?: number;
  label?: string;
  size?: number;
  className?: string;
}

export function RiskGauge({
  score,
  maxScore = 100,
  label = "Risk Score",
  size = 160,
  className = "",
}: RiskGaugeProps) {
  const normalized = Math.min(score / maxScore, 1);
  const startAngle = -210;
  const endAngle = 30;
  const totalArc = endAngle - startAngle;
  const sweepAngle = startAngle + totalArc * normalized;

  const radius = (size - 20) / 2;
  const cx = size / 2;
  const cy = size / 2 + 10;

  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const current = polarToCartesian(sweepAngle);

  const largeArc = sweepAngle - startAngle > 180 ? 1 : 0;
  const bgLargeArc = totalArc > 180 ? 1 : 0;

  const bgPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${bgLargeArc} 1 ${end.x} ${end.y}`;
  const valuePath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${current.x} ${current.y}`;

  const color = getRiskColor(score);

  const getLabel = () => {
    if (score >= 80) return "Critical";
    if (score >= 60) return "High";
    if (score >= 40) return "Medium";
    if (score >= 20) return "Low";
    return "Minimal";
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg
        width={size}
        height={size * 0.7}
        viewBox={`0 0 ${size} ${size * 0.7}`}
      >
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="#1a1a2e"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Value arc */}
        <motion.path
          d={valuePath}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />

        {/* Glow */}
        <motion.circle
          cx={current.x}
          cy={current.y}
          r="6"
          fill={color}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.3, scale: 1 }}
          transition={{ delay: 1.2, duration: 0.3 }}
        />
        <motion.circle
          cx={current.x}
          cy={current.y}
          r="3"
          fill={color}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2, duration: 0.3 }}
        />
      </svg>

      {/* Score and label */}
      <div className="mt-[-20px] text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          <span className="text-4xl font-bold" style={{ color }}>
            {Math.round(score)}
          </span>
        </motion.div>
        <div className="mt-1 text-xs font-semibold" style={{ color }}>
          {getLabel()}
        </div>
        <div className="text-[10px] text-text-muted">{label}</div>
      </div>
    </div>
  );
}
