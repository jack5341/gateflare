import type { LogLevel, LogEntry } from "./types";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): LogEntry;
  info(message: string, meta?: Record<string, unknown>): LogEntry;
  warn(message: string, meta?: Record<string, unknown>): LogEntry;
  error(message: string, meta?: Record<string, unknown>): LogEntry;
}

export function createLogger(
  minLevel: LogLevel,
  requestId: string,
  route: string | null
): Logger {
  function log(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>
  ): LogEntry {
    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      request_id: requestId,
      route,
      message,
      ...(meta !== undefined && { meta }),
    };

    if (LEVELS[level] >= LEVELS[minLevel]) {
      console.log(JSON.stringify(entry));
    }

    return entry;
  }

  return {
    debug: (msg, meta) => log("debug", msg, meta),
    info: (msg, meta) => log("info", msg, meta),
    warn: (msg, meta) => log("warn", msg, meta),
    error: (msg, meta) => log("error", msg, meta),
  };
}
