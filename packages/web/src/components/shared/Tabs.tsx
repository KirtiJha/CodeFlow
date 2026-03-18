import { type ReactNode } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { motion } from "framer-motion";

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  tabs: Array<{
    value: string;
    label: string;
    icon?: ReactNode;
    count?: number;
  }>;
  children?: ReactNode;
  className?: string;
}

export function Tabs({
  value,
  onValueChange,
  tabs,
  children,
  className = "",
}: TabsProps) {
  return (
    <RadixTabs.Root
      value={value}
      onValueChange={onValueChange}
      className={className}
    >
      <RadixTabs.List className="flex gap-1 border-b border-border-default px-1">
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className="group relative flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-text-muted outline-none transition-colors hover:text-text-secondary data-[state=active]:text-text-primary"
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded-full bg-bg-elevated px-1.5 py-0.5 text-[10px] font-semibold text-text-muted group-data-[state=active]:bg-accent-blue/15 group-data-[state=active]:text-accent-blue">
                {tab.count}
              </span>
            )}
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue"
              initial={false}
              animate={{ opacity: value === tab.value ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            />
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export function TabContent({
  value,
  activeValue: _activeValue,
  children,
}: {
  value: string;
  activeValue?: string;
  children: ReactNode;
}) {
  return (
    <RadixTabs.Content value={value} className="mt-4 outline-none">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </RadixTabs.Content>
  );
}
