import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  glass?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({
  children,
  className = "",
  onClick,
  hover = false,
  glass = true,
  padding = "md",
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onClick={onClick}
      className={`
        rounded-xl ${paddingMap[padding]}
        ${glass ? "glass" : "bg-bg-surface border border-border-default"}
        ${hover ? "cursor-pointer transition-all duration-200 hover:border-border-focus hover:shadow-lg hover:shadow-accent-blue/5" : ""}
        ${onClick ? "cursor-pointer" : ""}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({ title, subtitle, action, icon }: CardHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-blue/10 text-accent-blue">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  change?: number;
  color?: string;
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  icon,
  change,
  color = "blue",
  onClick,
}: MetricCardProps) {
  const colorMap: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-600/5 text-blue-400",
    green: "from-green-500/20 to-green-600/5 text-green-400",
    amber: "from-amber-500/20 to-amber-600/5 text-amber-400",
    red: "from-red-500/20 to-red-600/5 text-red-400",
    purple: "from-purple-500/20 to-purple-600/5 text-purple-400",
    cyan: "from-cyan-500/20 to-cyan-600/5 text-cyan-400",
  };

  return (
    <Card className="relative overflow-hidden" onClick={onClick}>
      <div
        className={`absolute inset-0 bg-gradient-to-br ${colorMap[color] ?? colorMap.blue} opacity-50`}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text-secondary">
            {title}
          </span>
          <div
            className={`${colorMap[color]?.split(" ").pop() ?? "text-blue-400"}`}
          >
            {icon}
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold text-text-primary">{value}</div>
        {change !== undefined && (
          <div
            className={`mt-1 text-xs font-medium ${
              change >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {change >= 0 ? "↑" : "↓"} {Math.abs(change)}%
          </div>
        )}
      </div>
    </Card>
  );
}
