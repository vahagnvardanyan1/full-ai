// ──────────────────────────────────────────────────────────
// Structured logger — thin wrapper so we can swap to pino/winston later
// ──────────────────────────────────────────────────────────

type Level = "debug" | "info" | "warn" | "error";

function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  const entry = {
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
