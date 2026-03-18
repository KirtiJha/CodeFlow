import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { FolderOpen, Search, GitBranch, Shield, Database, Network, BarChart3, TestTube2 } from 'lucide-react';

interface EmptyStateProps {
  icon?: "folder" | "search" | "branch" | "shield" | "database" | "graph" | "chart" | "test";
  title: string;
  description?: string;
  action?: ReactNode;
}

const iconMap = {
  folder: FolderOpen,
  search: Search,
  branch: GitBranch,
  shield: Shield,
  database: Database,
  graph: Network,
  chart: BarChart3,
  test: TestTube2,
};

export function EmptyState({
  icon = "folder",
  title,
  description,
  action,
}: EmptyStateProps) {
  const Icon = iconMap[icon];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-elevated">
        <Icon className="h-8 w-8 text-text-muted" />
      </div>
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}
