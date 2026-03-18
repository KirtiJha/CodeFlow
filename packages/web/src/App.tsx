import { Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatusBar } from "@/components/layout/StatusBar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { useUIStore } from "@/stores/ui-store";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { TracePage } from "@/pages/TracePage";
import { BranchesPage } from "@/pages/BranchesPage";
import { TestImpactPage } from "@/pages/TestImpactPage";
import { SecurityPage } from "@/pages/SecurityPage";
import { SchemaPage } from "@/pages/SchemaPage";
import { RiskPage } from "@/pages/RiskPage";
import { GraphPage } from "@/pages/GraphPage";
import { SettingsPage } from "@/pages/SettingsPage";

export default function App() {
  const { sidebarCollapsed, commandPaletteOpen, setCommandPaletteOpen } =
    useUIStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-base text-text-primary">
      <Sidebar collapsed={sidebarCollapsed} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<OnboardingPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/trace" element={<TracePage />} />
              <Route path="/branches" element={<BranchesPage />} />
              <Route path="/tests" element={<TestImpactPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/schema" element={<SchemaPage />} />
              <Route path="/risk" element={<RiskPage />} />
              <Route path="/graph" element={<GraphPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </main>

        <StatusBar />
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
    </div>
  );
}
