import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { BranchMatrix } from "@/components/branch/BranchMatrix";
import { BranchTimeline } from "@/components/branch/BranchTimeline";
import { ConflictCard } from "@/components/branch/ConflictCard";
import { ConflictDiff } from "@/components/branch/ConflictDiff";
import { BranchGraph } from "@/components/branch/BranchGraph";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Tabs, TabContent } from "@/components/shared/Tabs";
import { Select } from "@/components/shared/Select";
import { useBranches } from "@/hooks/useBranches";
import { useBranchStore } from "@/stores/branch-store";
import { PAGE_VARIANTS } from "@/lib/constants";
import { api } from "@/lib/api-client";
import type { FileDiff } from "@/types/branch";

export function BranchesPage() {
  const {
    branches,
    conflicts,
    matrix,
    selectedConflict,
    selectConflict,
    filterSeverity,
    setFilterSeverity,
    isLoading,
  } = useBranchStore();
  const { fetchBranches, fetchConflicts } = useBranches();
  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  const [activeTab, setActiveTab] = useState("matrix");

  useEffect(() => {
    fetchBranches();
    fetchConflicts();
  }, []);

  useEffect(() => {
    if (!selectedConflict) {
      setDiffs([]);
      return;
    }
    api
      .diffBranches(selectedConflict.branch1, selectedConflict.branch2)
      .then((res) => setDiffs((res.data as { diffs?: FileDiff[] })?.diffs ?? []))
      .catch(() => setDiffs([]));
  }, [selectedConflict]);

  const filteredConflicts = filterSeverity
    ? conflicts.filter((c) => c.severity === filterSeverity)
    : conflicts;

  const tabs = [
    { value: "matrix", label: "Matrix", count: branches.length },
    { value: "timeline", label: "Timeline" },
    { value: "graph", label: "Graph" },
  ];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <EmptyState
        icon="branch"
        title="No Branches Found"
        description="Analyze a Git repository to detect branch conflicts."
      />
    );
  }

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex h-full flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <Tabs tabs={tabs} value={activeTab} onValueChange={setActiveTab} />
        <Select
          value={filterSeverity ?? "all"}
          onValueChange={(v) => setFilterSeverity(v === "all" ? null : v)}
          options={[
            { value: "all", label: "All Severities" },
            { value: "critical", label: "Critical" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
          placeholder="Filter severity"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Allotment>
          <Allotment.Pane minSize={400}>
            <div className="h-full overflow-auto p-4">
              <TabContent value="matrix" activeValue={activeTab}>
                {matrix && (
                  <BranchMatrix
                    matrix={matrix}
                    onCellClick={(b1, b2) => {
                      const conflict = conflicts.find(
                        (c) =>
                          (c.branch1 === b1 && c.branch2 === b2) ||
                          (c.branch1 === b2 && c.branch2 === b1),
                      );
                      if (conflict) selectConflict(conflict);
                    }}
                  />
                )}
              </TabContent>

              <TabContent value="timeline" activeValue={activeTab}>
                <BranchTimeline branches={branches} conflicts={conflicts} />
              </TabContent>

              <TabContent value="graph" activeValue={activeTab}>
                <div className="h-[500px]">
                  <BranchGraph
                    branches={branches}
                    conflicts={conflicts}
                    selectedBranch={selectedConflict?.branch1}
                  />
                </div>
              </TabContent>
            </div>
          </Allotment.Pane>

          <Allotment.Pane minSize={300} preferredSize={400}>
            <div className="flex h-full flex-col border-l border-border-default">
              {selectedConflict ? (
                <ConflictDiff conflict={selectedConflict} diffs={diffs} />
              ) : (
                <div className="flex-1 overflow-auto p-4">
                  <h3 className="mb-3 text-sm font-semibold text-text-primary">
                    Conflicts ({filteredConflicts.length})
                  </h3>
                  <div className="space-y-2">
                    {filteredConflicts.map((conflict, i) => (
                      <ConflictCard
                        key={`${conflict.branch1}-${conflict.branch2}-${i}`}
                        conflict={conflict}
                        onClick={() => selectConflict(conflict)}
                        selected={selectedConflict === conflict}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>
    </motion.div>
  );
}
