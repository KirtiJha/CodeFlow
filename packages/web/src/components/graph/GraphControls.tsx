import { useState } from "react";
import { motion } from "framer-motion";
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  Filter,
  Search,
} from "lucide-react";
import { Tooltip } from "@/components/shared/Tooltip";
import type { GraphFilter } from "@/types/graph";

interface GraphControlsProps {
  filter: GraphFilter;
  onFilterChange: (filter: Partial<GraphFilter>) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReLayout: () => void;
  availableKinds: string[];
  availableLanguages: string[];
  availableCommunities: string[];
  className?: string;
}

export function GraphControls({
  filter,
  onFilterChange,
  onZoomIn,
  onZoomOut,
  onFit,
  onReLayout,
  availableKinds,
  availableLanguages: _availableLanguages,
  availableCommunities: _availableCommunities,
  className = "",
}: GraphControlsProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Zoom controls */}
      <div className="glass flex flex-col gap-1 rounded-lg p-1">
        <ControlButton
          icon={<ZoomIn className="h-4 w-4" />}
          label="Zoom In"
          onClick={onZoomIn}
        />
        <ControlButton
          icon={<ZoomOut className="h-4 w-4" />}
          label="Zoom Out"
          onClick={onZoomOut}
        />
        <ControlButton
          icon={<Maximize className="h-4 w-4" />}
          label="Fit"
          onClick={onFit}
        />
        <ControlButton
          icon={<RotateCcw className="h-4 w-4" />}
          label="Re-layout"
          onClick={onReLayout}
        />
      </div>

      {/* Filter toggle */}
      <div className="glass rounded-lg p-1">
        <ControlButton
          icon={<Filter className="h-4 w-4" />}
          label="Filters"
          onClick={() => setShowFilters(!showFilters)}
          active={showFilters}
        />
      </div>

      {/* Filter panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass absolute left-14 top-0 w-64 rounded-lg p-4"
        >
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Filters
          </h4>

          <div className="space-y-3">
            {/* Search */}
            <div className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-surface px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                value={filter.searchQuery}
                onChange={(e) =>
                  onFilterChange({ searchQuery: e.target.value })
                }
                placeholder="Filter nodes…"
                className="flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted"
              />
            </div>

            {/* Kind filter */}
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase text-text-muted">
                Node Types
              </label>
              <div className="flex flex-wrap gap-1">
                {availableKinds.slice(0, 10).map((kind) => (
                  <button
                    key={kind}
                    onClick={() => {
                      const kinds = filter.kinds.includes(kind)
                        ? filter.kinds.filter((k) => k !== kind)
                        : [...filter.kinds, kind];
                      onFilterChange({ kinds });
                    }}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      filter.kinds.includes(kind)
                        ? "bg-accent-blue/20 text-accent-blue"
                        : "bg-bg-elevated text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {kind}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk slider */}
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase text-text-muted">
                Min Risk: {filter.minRisk.toFixed(1)}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={filter.minRisk}
                onChange={(e) =>
                  onFilterChange({ minRisk: parseFloat(e.target.value) })
                }
                className="w-full accent-accent-blue"
              />
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={filter.showTests}
                  onChange={(e) =>
                    onFilterChange({ showTests: e.target.checked })
                  }
                  className="rounded accent-accent-blue"
                />
                Show test nodes
              </label>
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={filter.showEntryPoints}
                  onChange={(e) =>
                    onFilterChange({ showEntryPoints: e.target.checked })
                  }
                  className="rounded accent-accent-blue"
                />
                Show entry points
              </label>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ControlButton({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Tooltip content={label} side="right">
      <button
        onClick={onClick}
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          active
            ? "bg-accent-blue/15 text-accent-blue"
            : "text-text-muted hover:bg-bg-elevated hover:text-text-secondary"
        }`}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
