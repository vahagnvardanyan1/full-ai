// ──────────────────────────────────────────────────────────
// Logger adapter — replaces v3's pino with full-ai's logger
// ──────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";

interface ChildLogger {
  info: (objOrMsg: unknown, msg?: string) => void;
  warn: (objOrMsg: unknown, msg?: string) => void;
  error: (objOrMsg: unknown, msg?: string) => void;
  debug: (objOrMsg: unknown, msg?: string) => void;
}

export function createChildLogger(name: string): ChildLogger {
  const log = (level: "info" | "warn" | "error", objOrMsg: unknown, msg?: string) => {
    if (typeof objOrMsg === "string") {
      logger[level](`[${name}] ${objOrMsg}`);
    } else {
      logger[level](`[${name}] ${msg ?? ""}`, objOrMsg as Record<string, unknown>);
    }
  };

  return {
    info: (o, m?) => log("info", o, m),
    warn: (o, m?) => log("warn", o, m),
    error: (o, m?) => log("error", o, m),
    debug: (o, m?) => log("info", o, m), // map debug → info
  };
}
