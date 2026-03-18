import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { TestList } from "@/components/test/TestList";
import { TestCoverage } from "@/components/test/TestCoverage";
import { UncoveredPaths } from "@/components/test/UncoveredPaths";
import { CodeViewer } from "@/components/code/CodeViewer";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Tabs, TabContent } from "@/components/shared/Tabs";
import { useTestStore } from "@/stores/test-store";
import { api } from "@/lib/api-client";
import { PAGE_VARIANTS } from "@/lib/constants";

export function TestImpactPage() {
  const {
    impactResult,
    selectedTest,
    gaps,
    changedFiles,
    setImpactResult,
    selectTest,
    setGaps,
  } = useTestStore();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("affected");
  const [filesInput, setFilesInput] = useState(changedFiles.join(", "));

  const analyze = useCallback(async () => {
    const files = filesInput
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);
    if (files.length === 0) return;

    setIsLoading(true);
    try {
      const [impactRes, gapsRes] = await Promise.all([
        api.testImpact(files),
        api.testGaps(),
      ]);
      setImpactResult(impactRes.data as import("@/types/api").TestImpactResult);
      setGaps((gapsRes.data as { gaps?: import("@/types/api").TestGap[] })?.gaps ?? []);
    } catch {
      // handled by api-client error hook
    } finally {
      setIsLoading(false);
    }
  }, [filesInput, setImpactResult, setGaps]);

  const tabs = [
    {
      value: "affected",
      label: "Affected Tests",
      count: impactResult?.tests?.length,
    },
    { value: "coverage", label: "Coverage" },
    { value: "gaps", label: "Gaps", count: gaps.length },
  ];

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex h-full flex-col"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border-default px-4 py-3">
        <input
          type="text"
          value={filesInput}
          onChange={(e) => setFilesInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && analyze()}
          placeholder="Changed files (comma-separated, e.g. src/auth.ts, src/db.ts)..."
          className="flex-1 rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <button
          onClick={analyze}
          disabled={isLoading || !filesInput.trim()}
          className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white transition-all hover:bg-accent-blue/90 disabled:opacity-50"
        >
          {isLoading ? "Analyzing..." : "Analyze Impact"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : impactResult ? (
          <>
            <div className="border-b border-border-default px-4">
              <Tabs
                tabs={tabs}
                value={activeTab}
                onValueChange={setActiveTab}
              />
            </div>
            <Allotment>
              <Allotment.Pane minSize={300}>
                <div className="h-full overflow-auto p-4">
                  <TabContent value="affected" activeValue={activeTab}>
                    <TestList
                      tests={impactResult.tests ?? []}
                      selectedTestId={selectedTest?.id}
                      onSelect={selectTest}
                    />
                  </TabContent>

                  <TabContent value="coverage" activeValue={activeTab}>
                    <TestCoverage
                      covered={impactResult.coverage?.covered ?? 0}
                      total={impactResult.coverage?.total ?? 0}
                      byFile={impactResult.coverage?.byFile}
                    />
                  </TabContent>

                  <TabContent value="gaps" activeValue={activeTab}>
                    <UncoveredPaths gaps={gaps} />
                  </TabContent>
                </div>
              </Allotment.Pane>

              {selectedTest && (
                <Allotment.Pane minSize={300} preferredSize={400}>
                  <div className="flex h-full flex-col border-l border-border-default">
                    <div className="border-b border-border-default px-4 py-3">
                      <div className="text-sm font-semibold text-text-primary">
                        {selectedTest.name}
                      </div>
                      <div className="text-xs text-text-muted">
                        {selectedTest.file}
                        {selectedTest.line ? `:${selectedTest.line}` : ""}
                      </div>
                    </div>
                    <div className="flex-1 overflow-auto">
                      <CodeViewer
                        code={selectedTest.codeSnippet ?? ""}
                        language="typescript"
                        highlightLines={
                          selectedTest.line ? [selectedTest.line] : []
                        }
                      />
                    </div>
                  </div>
                </Allotment.Pane>
              )}
            </Allotment>
          </>
        ) : (
          <EmptyState
            icon="test"
            title="Test Impact Analysis"
            description="Enter changed file paths to discover which tests are affected and find coverage gaps."
          />
        )}
      </div>
    </motion.div>
  );
}
