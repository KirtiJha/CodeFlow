import { Worker } from "node:worker_threads";
import { cpus } from "node:os";
import { createLogger } from "../utils/logger.js";

const log = createLogger("workers:pool");

export interface WorkerTask<T = unknown> {
  type: string;
  payload: T;
}

export interface WorkerResult<T = unknown> {
  taskIndex: number;
  result?: T;
  error?: string;
}

interface PoolWorker {
  worker: Worker;
  busy: boolean;
}

/**
 * Generic worker pool for CPU-parallel job scheduling.
 * Uses worker_threads with structured clone for communication.
 */
export class WorkerPool {
  private workers: PoolWorker[] = [];
  private taskQueue: Array<{
    task: WorkerTask;
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
  }> = [];
  private readonly workerCount: number;
  private shuttingDown = false;

  constructor(
    private readonly workerPath: string,
    workerCount?: number,
  ) {
    this.workerCount =
      workerCount ?? Math.min(8, Math.max(1, cpus().length - 1));
  }

  /**
   * Initialize the worker pool by spawning worker threads.
   */
  async start(): Promise<void> {
    log.info(
      { count: this.workerCount, path: this.workerPath },
      "Starting worker pool",
    );

    for (let i = 0; i < this.workerCount; i++) {
      const worker = new Worker(this.workerPath);
      const poolWorker: PoolWorker = { worker, busy: false };

      worker.on("message", (result: WorkerResult) => {
        this.handleResult(poolWorker, result);
      });

      worker.on("error", (err) => {
        log.error({ err, workerIndex: i }, "Worker error");
        poolWorker.busy = false;
        this.processQueue();
      });

      worker.on("exit", (code) => {
        if (!this.shuttingDown && code !== 0) {
          log.warn({ code, workerIndex: i }, "Worker exited unexpectedly");
        }
      });

      this.workers.push(poolWorker);
    }
  }

  /**
   * Execute a task on the next available worker.
   */
  async execute<R = unknown>(task: WorkerTask): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      this.taskQueue.push({
        task,
        resolve: resolve as (result: unknown) => void,
        reject,
      });
      this.processQueue();
    });
  }

  /**
   * Execute multiple tasks and return all results.
   */
  async executeAll<T, R>(tasks: WorkerTask<T>[]): Promise<R[]> {
    const promises = tasks.map((task) => this.execute<R>(task));
    return Promise.all(promises);
  }

  /**
   * Gracefully shut down all workers.
   */
  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    log.info("Shutting down worker pool");

    const terminatePromises = this.workers.map(async ({ worker }) => {
      await worker.terminate();
    });

    await Promise.all(terminatePromises);
    this.workers = [];
    this.taskQueue = [];
  }

  get activeWorkers(): number {
    return this.workers.filter((w) => w.busy).length;
  }

  get pendingTasks(): number {
    return this.taskQueue.length;
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0) return;

    const available = this.workers.find((w) => !w.busy);
    if (!available) return;

    const queued = this.taskQueue.shift();
    if (!queued) return;

    available.busy = true;
    available.worker.postMessage(queued.task);

    // Store the resolve/reject on the worker temporarily
    (available as PoolWorker & { _pending?: typeof queued })._pending = queued;
  }

  private handleResult(poolWorker: PoolWorker, result: WorkerResult): void {
    poolWorker.busy = false;

    const pending = (
      poolWorker as PoolWorker & {
        _pending?: {
          resolve: (r: unknown) => void;
          reject: (e: Error) => void;
        };
      }
    )._pending;
    if (pending) {
      if (result.error) {
        pending.reject(new Error(result.error));
      } else {
        pending.resolve(result.result);
      }
      (poolWorker as PoolWorker & { _pending?: unknown })._pending = undefined;
    }

    this.processQueue();
  }
}
