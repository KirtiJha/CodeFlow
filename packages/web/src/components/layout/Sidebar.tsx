import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  GitFork,
  GitBranch,
  TestTube2,
  Shield,
  Database,
  AlertTriangle,
  Network,
  Settings,
  ChevronLeft,
  Workflow,
} from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { Tooltip } from "@/components/shared/Tooltip";
import { ROUTES } from "@/lib/constants";

interface SidebarProps {
  collapsed: boolean;
}

const navItems = [
  { to: ROUTES.dashboard, icon: LayoutDashboard, label: "Dashboard" },
  { to: ROUTES.trace, icon: GitFork, label: "Trace" },
  { to: ROUTES.branches, icon: GitBranch, label: "Branches" },
  { to: ROUTES.tests, icon: TestTube2, label: "Tests" },
  { to: ROUTES.security, icon: Shield, label: "Security" },
  { to: ROUTES.schema, icon: Database, label: "Schema" },
  { to: ROUTES.risk, icon: AlertTriangle, label: "Risk" },
  { to: ROUTES.graph, icon: Network, label: "Graph" },
  { to: ROUTES.settings, icon: Settings, label: "Settings" },
];

export function Sidebar({ collapsed }: SidebarProps) {
  const { toggleSidebar } = useUIStore();
  const location = useLocation();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 60 : 220 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative flex h-full flex-col border-r border-border-default bg-bg-surface"
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border-default px-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple">
          <Workflow className="h-4.5 w-4.5 text-white" />
        </div>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm font-bold tracking-tight text-text-primary"
          >
            CodeFlow
          </motion.span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            const link = (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-accent-blue/10 text-accent-blue"
                      : "text-text-muted hover:bg-bg-elevated hover:text-text-secondary"
                  }`}
                >
                  <item.icon
                    className={`h-4.5 w-4.5 flex-shrink-0 ${isActive ? "text-accent-blue" : ""}`}
                  />
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.05 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute left-0 h-6 w-0.5 rounded-r bg-accent-blue"
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </NavLink>
              </li>
            );

            return collapsed ? (
              <Tooltip key={item.to} content={item.label} side="right">
                {link}
              </Tooltip>
            ) : (
              link
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border-default p-2">
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-secondary"
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.div>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}
