import { createLogger } from "../utils/logger.js";

const log = createLogger("pipeline:progress");

export type Phase =
  | "parsing"
  | "symbols"
  | "cfg"
  | "dfg"
  | "callgraph"
  | "summaries"
  | "communities"
  | "processes"
  | "tests"
  | "schema"
  | "taint"
  | "metrics";

export const PHASE_ORDER: Phase[] = [
  "parsing",
  "symbols",
  "cfg",
  "dfg",
  "callgraph",
  "summaries",
  "communities",
  "processes",
  "tests",
  "schema",
  "taint",
  "metrics",
];

export type ProgressCallback = (
  phase: Phase,
  pct: number,
  message: string,
) => void;

/**
 * Tracks and reports pipeline progress across all 12 phases.
 */
export class ProgressTracker {
  private currentPhase: Phase = "parsing";
  private phaseProgress = new Map<Phase, number>();
  private startTime: number = 0;
  private phaseStartTime: number = 0;

  constructor(private readonly onProgress?: ProgressCallback) {
    for (const phase of PHASE_ORDER) {
      this.phaseProgress.set(phase, 0);
    }
  }

  start(): void {
    this.startTime = Date.now();
    log.info("Pipeline started");
  }

  beginPhase(phase: Phase): void {
    this.currentPhase = phase;
    this.phaseStartTime = Date.now();
    this.phaseProgress.set(phase, 0);
    log.info({ phase }, "Phase started");
    this.notify(0, `Starting ${phase}...`);
  }

  updatePhase(pct: number, message?: string): void {
    const clamped = Math.min(100, Math.max(0, pct));
    this.phaseProgress.set(this.currentPhase, clamped);
    this.notify(clamped, message ?? `${this.currentPhase}: ${clamped}%`);
  }

  endPhase(): void {
    const duration = Date.now() - this.phaseStartTime;
    this.phaseProgress.set(this.currentPhase, 100);
    log.info(
      { phase: this.currentPhase, durationMs: duration },
      "Phase completed",
    );
    this.notify(100, `${this.currentPhase} complete (${duration}ms)`);
  }

  finish(): { totalDurationMs: number } {
    const totalDurationMs = Date.now() - this.startTime;
    log.info({ totalDurationMs }, "Pipeline completed");
    return { totalDurationMs };
  }

  /** Get overall progress as 0-100. */
  get overallProgress(): number {
    let total = 0;
    for (const pct of this.phaseProgress.values()) {
      total += pct;
    }
    return total / PHASE_ORDER.length;
  }

  private notify(pct: number, message: string): void {
    if (this.onProgress) {
      this.onProgress(this.currentPhase, pct, message);
    }
  }
}
