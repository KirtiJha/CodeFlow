import { motion } from "framer-motion";
import { useSettingsStore } from "@/stores/settings-store";
import { PAGE_VARIANTS } from "@/lib/constants";

export function SettingsPage() {
  const settings = useSettingsStore();

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="h-full overflow-auto p-6"
    >
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-muted">
            Configure CodeFlow analysis and display preferences.
          </p>
        </div>

        {/* Analysis settings */}
        <Section title="Analysis">
          <Field
            label="Exclude Patterns"
            description="Glob patterns to exclude from analysis (one per line)"
          >
            <textarea
              value={settings.analysis.excludePatterns.join("\n")}
              onChange={(e) =>
                settings.updateAnalysis({
                  excludePatterns: e.target.value.split("\n").filter(Boolean),
                })
              }
              rows={3}
              className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
              placeholder="node_modules/**&#10;dist/**&#10;*.test.ts"
            />
          </Field>

          <Field
            label="Languages"
            description="Languages to include in analysis"
          >
            <input
              type="text"
              value={settings.analysis.languages.join(", ")}
              onChange={(e) =>
                settings.updateAnalysis({
                  languages: e.target.value
                    .split(",")
                    .map((l) => l.trim())
                    .filter(Boolean),
                })
              }
              className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
              placeholder="typescript, javascript, python"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Max File Size (KB)">
              <input
                type="number"
                value={settings.analysis.maxFileSize}
                onChange={(e) =>
                  settings.updateAnalysis({ maxFileSize: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
              />
            </Field>
            <Field label="Worker Count">
              <input
                type="number"
                value={settings.analysis.workerCount}
                min={1}
                max={16}
                onChange={(e) =>
                  settings.updateAnalysis({ workerCount: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
              />
            </Field>
          </div>
        </Section>

        {/* Branch settings */}
        <Section title="Branch Monitoring">
          <Toggle
            label="Auto-scan branches"
            description="Automatically scan for branch conflicts"
            checked={settings.branches.autoScan}
            onChange={(v) => settings.updateBranches({ autoScan: v })}
          />
          <Field label="Scan Interval (seconds)">
            <input
              type="number"
              value={settings.branches.scanInterval}
              min={10}
              onChange={(e) =>
                settings.updateBranches({ scanInterval: Number(e.target.value) })
              }
              className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            />
          </Field>
          <Field label="Minimum Severity">
            <select
              value={settings.branches.minSeverity}
              onChange={(e) =>
                settings.updateBranches({ minSeverity: e.target.value })
              }
              className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </Field>
        </Section>

        {/* Security settings */}
        <Section title="Security">
          <Toggle
            label="Enable Taint Analysis"
            description="Track data flow from sources to sinks"
            checked={settings.security.enableTaintAnalysis}
            onChange={(v) => settings.updateSecurity({ enableTaintAnalysis: v })}
          />
          <Field
            label="Custom Sources"
            description="Additional taint sources (one per line)"
          >
            <textarea
              value={settings.security.customSources.join("\n")}
              onChange={(e) =>
                settings.updateSecurity({
                  customSources: e.target.value.split("\n").filter(Boolean),
                })
              }
              rows={2}
              className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
              placeholder="req.body&#10;req.query"
            />
          </Field>
          <Field
            label="Custom Sinks"
            description="Additional taint sinks (one per line)"
          >
            <textarea
              value={settings.security.customSinks.join("\n")}
              onChange={(e) =>
                settings.updateSecurity({
                  customSinks: e.target.value.split("\n").filter(Boolean),
                })
              }
              rows={2}
              className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
              placeholder="db.query&#10;eval"
            />
          </Field>
        </Section>

        {/* Display settings */}
        <Section title="Display">
          <Field label="Graph Layout">
            <select
              value={settings.display.graphLayout}
              onChange={(e) =>
                settings.updateDisplay({ graphLayout: e.target.value as 'force' | 'circular' | 'tree' })
              }
              className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            >
              <option value="forceatlas2">ForceAtlas2</option>
              <option value="circular">Circular</option>
              <option value="random">Random</option>
            </select>
          </Field>
          <Field label="Max Graph Nodes">
            <input
              type="number"
              value={settings.display.maxGraphNodes}
              min={50}
              max={10000}
              onChange={(e) =>
                settings.updateDisplay({ maxGraphNodes: Number(e.target.value) })
              }
              className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            />
          </Field>
          <Field label="Code Theme">
            <select
              value={settings.display.codeTheme}
              onChange={(e) =>
                settings.updateDisplay({ codeTheme: e.target.value })
              }
              className="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
            >
              <option value="vitesse-dark">Vitesse Dark</option>
              <option value="github-dark">GitHub Dark</option>
              <option value="dracula">Dracula</option>
              <option value="one-dark-pro">One Dark Pro</option>
            </select>
          </Field>
          <Toggle
            label="Show Line Numbers"
            checked={settings.display.showLineNumbers}
            onChange={(v) => settings.updateDisplay({ showLineNumbers: v })}
          />
        </Section>
      </div>
    </motion.div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border-default bg-bg-surface p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-primary">
        {label}
      </label>
      {description && (
        <p className="mb-2 text-xs text-text-muted">{description}</p>
      )}
      {children}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm font-medium text-text-primary">{label}</span>
        {description && (
          <p className="text-xs text-text-muted">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-accent-blue" : "bg-bg-elevated"
        }`}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
