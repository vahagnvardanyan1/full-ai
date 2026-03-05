// ──────────────────────────────────────────────────────────
// Structured logger — thin wrapper so we can swap to pino/winston later
//
// When SHOW_DEBUG_UI=true, logs are also buffered in memory
// and broadcast to SSE listeners via the debug panel.
// ──────────────────────────────────────────────────────────

type Level = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  ts: string;
  level: Level;
  msg: string;
  [key: string]: unknown;
}

type LogListener = (entry: LogEntry) => void;

const MAX_BUFFER = 500;
const logBuffer: LogEntry[] = [];
const listeners = new Set<LogListener>();

function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }

  // Buffer for debug UI
  if (process.env.SHOW_DEBUG_UI === "true") {
    logBuffer.push(entry);
    if (logBuffer.length > MAX_BUFFER) {
      logBuffer.splice(0, logBuffer.length - MAX_BUFFER);
    }
    for (const listener of listeners) {
      try {
        listener(entry);
      } catch {
        listeners.delete(listener);
      }
    }
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) =>
    log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) =>
    log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) =>
    log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) =>
    log("error", msg, meta),
};

/** Get buffered log entries */
export function getLogBuffer(): LogEntry[] {
  return [...logBuffer];
}

/** Subscribe to new log entries (for SSE streaming) */
export function subscribeToLogs(listener: LogListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
