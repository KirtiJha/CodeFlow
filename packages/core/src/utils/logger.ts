import pino from "pino";

export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal"
  | "silent";

const DEFAULT_LEVEL: LogLevel =
  (process.env.CODEFLOW_LOG_LEVEL as LogLevel) ?? "info";

export function createLogger(name: string, level?: LogLevel): pino.Logger {
  return pino({
    name,
    level: level ?? DEFAULT_LEVEL,
    transport:
      process.env.NODE_ENV !== "production"
        ? {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "HH:MM:ss" },
          }
        : undefined,
    serializers: pino.stdSerializers,
  });
}

/** Shared root logger for quick imports */
export const logger = createLogger("codeflow");
