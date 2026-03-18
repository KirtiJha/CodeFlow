import { getSeverityColor } from "@/lib/color-system";
import { formatSeverity } from "@/lib/formatters";

interface BadgeProps {
  variant: "severity" | "kind" | "language" | "status";
  value: string;
  pulse?: boolean;
  className?: string;
}

const KIND_STYLES: Record<string, string> = {
  function: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  class: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  method: "bg-blue-400/15 text-blue-300 border-blue-400/30",
  variable: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  interface: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  file: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  test: "bg-lime-500/15 text-lime-400 border-lime-500/30",
};

const STATUS_STYLES: Record<string, string> = {
  running: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export function Badge({ variant, value, pulse, className = "" }: BadgeProps) {
  let style = "";

  if (variant === "severity") {
    const colors = getSeverityColor(value);
    style = `bg-[${colors.bg}] text-[${colors.text}] border-[${colors.border}]`;
  } else if (variant === "kind") {
    style =
      KIND_STYLES[value] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30";
  } else if (variant === "status") {
    style =
      STATUS_STYLES[value] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30";
  } else {
    style = "bg-gray-500/15 text-gray-400 border-gray-500/30";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style} ${
        pulse ? "pulse-critical" : ""
      } ${className}`}
    >
      {variant === "severity" && (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: getSeverityColor(value).text }}
        />
      )}
      {variant === "severity" ? formatSeverity(value) : value}
    </span>
  );
}
