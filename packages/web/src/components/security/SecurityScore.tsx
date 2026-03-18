import { motion } from "framer-motion";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import type { SecurityScore as SecurityScoreType } from "@/types/security";

interface SecurityScoreProps {
  score: SecurityScoreType;
  className?: string;
}

export function SecurityScore({ score, className = "" }: SecurityScoreProps) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score.overall / 100) * circumference;

  const getGrade = (val: number) => {
    if (val >= 90) return { label: "A", color: "#10b981", Icon: ShieldCheck };
    if (val >= 75) return { label: "B", color: "#3b82f6", Icon: Shield };
    if (val >= 60) return { label: "C", color: "#f59e0b", Icon: Shield };
    if (val >= 40) return { label: "D", color: "#f97316", Icon: ShieldAlert };
    return { label: "F", color: "#ef4444", Icon: ShieldAlert };
  };

  const grade = getGrade(score.overall);

  const categories = [
    { label: "Taint Analysis", value: score.taintScore },
    { label: "Input Validation", value: score.inputValidation },
    { label: "Dependency Safety", value: score.dependencySafety },
    { label: "Data Flow", value: score.dataFlowScore },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main score */}
      <div className="flex items-center justify-center py-4">
        <div className="relative">
          <svg width="140" height="140" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#1a1a2e"
              strokeWidth="6"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={grade.color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <grade.Icon
              className="mb-0.5 h-5 w-5"
              style={{ color: grade.color }}
            />
            <span className="text-3xl font-bold" style={{ color: grade.color }}>
              {grade.label}
            </span>
            <span className="text-xs text-text-muted">{score.overall}/100</span>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const catGrade = getGrade(cat.value);
          return (
            <div key={cat.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">{cat.label}</span>
                <span style={{ color: catGrade.color }}>{cat.value}/100</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${cat.value}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: catGrade.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatBox label="Total Flows" value={score.totalFlows} />
        <StatBox
          label="Critical"
          value={score.criticalCount}
          color={score.criticalCount > 0 ? "#ef4444" : undefined}
        />
        <StatBox
          label="High"
          value={score.highCount}
          color={score.highCount > 0 ? "#f97316" : undefined}
        />
        <StatBox label="Resolved" value={score.resolvedCount} color="#10b981" />
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-elevated/30 p-3 text-center">
      <div className="text-lg font-bold" style={{ color: color ?? "#f0f0f5" }}>
        {value}
      </div>
      <div className="text-[10px] text-text-muted">{label}</div>
    </div>
  );
}
