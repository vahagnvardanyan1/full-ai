// ──────────────────────────────────────────────────────────
// Structured logger — thin wrapper so we can swap to pino/winston later
//
// When SHOW_DEBUG_UI=true, logs are persisted to MongoDB
// (fire-and-forget) and buffered in memory as fallback.
// ──────────────────────────────────────────────────────────

import { connectDB, isDBEnabled } from "@/lib/db/connection";
import { DebugLogModel } from "@/lib/db/models/debug-log";

type Level = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  ts: string;
  level: Level;
  msg: string;
  [key: string]: unknown;
}

const MAX_BUFFER = 500;
const logBuffer: LogEntry[] = [];

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

  // Buffer + persist for debug UI
  if (process.env.SHOW_DEBUG_UI === "true") {
    logBuffer.push(entry);
    if (logBuffer.length > MAX_BUFFER) {
      logBuffer.splice(0, logBuffer.length - MAX_BUFFER);
    }

    // Fire-and-forget MongoDB write
    if (isDBEnabled()) {
      const { ts: _ts, level: _lvl, msg: _msg, ...rest } = entry;
      connectDB().then((conn) => {
        if (!conn) return;
        DebugLogModel.create({
          ts: new Date(entry.ts),
          level: entry.level,
          msg: entry.msg,
          meta: rest,
        }).catch(() => {
          // silently ignore write failures
        });
      }).catch(() => {
        // silently ignore connection failures
      });
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

/** Get buffered log entries (fallback for local dev without MongoDB) */
export function getLogBuffer(): LogEntry[] {
  return [...logBuffer];
}
