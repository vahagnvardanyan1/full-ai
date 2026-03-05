"use client";

import { useState, useEffect, useRef } from "react";
import type { LogEntry } from "@/lib/logger";

const LEVEL_COLORS: Record<string, string> = {
  debug: "text-gray-400",
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};

const LEVEL_BG: Record<string, string> = {
  debug: "bg-gray-500/10",
  info: "bg-blue-500/10",
  warn: "bg-yellow-500/10",
  error: "bg-red-500/10",
};

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<Set<string>>(
    new Set(["debug", "info", "warn", "error"]),
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTsRef = useRef<string | null>(null);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const url = lastTsRef.current
          ? `/api/debug/logs?since=${encodeURIComponent(lastTsRef.current)}`
          : "/api/debug/logs";
        const res = await fetch(url);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const entries = data.logs as LogEntry[];
        if (entries.length > 0) {
          setLogs((prev) => {
            const next = [...prev, ...entries];
            if (next.length > 1000) return next.slice(-1000);
            return next;
          });
          lastTsRef.current = entries[entries.length - 1].ts;
          if (!isOpenRef.current) {
            setUnreadCount((c) => c + entries.length);
          }
        }
      } catch {
        // ignore fetch errors
      }
    };

    poll();
    const id = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (autoScroll && isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  const toggleLevel = (level: string) => {
    setLevelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  const filteredLogs = logs.filter((entry) => {
    if (!levelFilter.has(entry.level)) return false;
    if (filter) {
      const text = `${entry.msg} ${JSON.stringify(entry)}`.toLowerCase();
      if (!text.includes(filter.toLowerCase())) return false;
    }
    return true;
  });

  const formatMeta = (entry: LogEntry) => {
    const { ts, level, msg, ...meta } = entry;
    void ts;
    void level;
    void msg;
    if (Object.keys(meta).length === 0) return null;
    return JSON.stringify(meta);
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-[9999] flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold shadow-lg transition-all hover:scale-105"
        style={{
          background: isOpen
            ? "var(--accent, #6366f1)"
            : "var(--surface-raised, #1e1e2e)",
          color: isOpen ? "white" : "var(--text-muted, #a0a0b0)",
          border: "1px solid var(--surface-border, #2a2a3e)",
        }}
      >
        <span className="text-sm">{isOpen ? "X" : ">"}_</span>
        DEBUG
        {unreadCount > 0 && !isOpen && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-red-500 text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="fixed bottom-14 right-4 z-[9998] flex flex-col rounded-xl shadow-2xl overflow-hidden"
          style={{
            width: "min(720px, calc(100vw - 2rem))",
            height: "min(500px, calc(100vh - 6rem))",
            background: "var(--panel-bg, #0d0d14)",
            border: "1px solid var(--panel-border, #1e1e2e)",
            backdropFilter: "blur(24px)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-3 py-2 border-b"
            style={{ borderColor: "var(--surface-border, #1e1e2e)" }}
          >
            <span
              className="text-xs font-mono font-bold"
              style={{ color: "var(--text, #e0e0e0)" }}
            >
              Backend Logs
            </span>
            <span
              className="text-[10px] font-mono"
              style={{ color: "var(--text-muted, #666)" }}
            >
              ({filteredLogs.length})
            </span>

            {/* Level filters */}
            <div className="flex gap-1 ml-2">
              {(["debug", "info", "warn", "error"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => toggleLevel(level)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase transition-opacity ${
                    levelFilter.has(level) ? "opacity-100" : "opacity-30"
                  } ${LEVEL_COLORS[level]}`}
                  style={{
                    background: levelFilter.has(level)
                      ? undefined
                      : "transparent",
                    border: "1px solid var(--surface-border, #2a2a3e)",
                  }}
                >
                  {level}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="ml-auto px-2 py-1 rounded text-[11px] font-mono outline-none"
              style={{
                width: "140px",
                background: "var(--surface-raised, #1a1a2e)",
                color: "var(--text, #e0e0e0)",
                border: "1px solid var(--surface-border, #2a2a3e)",
              }}
            />

            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono transition-opacity"
              style={{
                opacity: autoScroll ? 1 : 0.4,
                background: "var(--surface-raised, #1a1a2e)",
                color: "var(--text-muted, #888)",
                border: "1px solid var(--surface-border, #2a2a3e)",
              }}
            >
              Auto-scroll
            </button>

            {/* Clear */}
            <button
              onClick={() => setLogs([])}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono"
              style={{
                background: "var(--surface-raised, #1a1a2e)",
                color: "var(--text-muted, #888)",
                border: "1px solid var(--surface-border, #2a2a3e)",
              }}
            >
              Clear
            </button>
          </div>

          {/* Log entries */}
          <div
            ref={containerRef}
            className="flex-1 overflow-y-auto overflow-x-hidden font-mono text-[11px] leading-[1.6]"
            style={{ padding: "4px 0" }}
          >
            {filteredLogs.length === 0 ? (
              <div
                className="flex items-center justify-center h-full text-xs"
                style={{ color: "var(--text-muted, #555)" }}
              >
                No logs yet. Waiting for backend activity...
              </div>
            ) : (
              filteredLogs.map((entry, i) => {
                const meta = formatMeta(entry);
                return (
                  <div
                    key={i}
                    className={`flex gap-2 px-3 py-[2px] hover:bg-white/[0.02] ${LEVEL_BG[entry.level]}`}
                  >
                    <span
                      className="shrink-0 text-[10px]"
                      style={{ color: "var(--text-muted, #555)" }}
                    >
                      {new Date(entry.ts).toLocaleTimeString("en-US", {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span
                      className={`shrink-0 w-10 text-[10px] uppercase font-bold ${LEVEL_COLORS[entry.level]}`}
                    >
                      {entry.level}
                    </span>
                    <span style={{ color: "var(--text, #e0e0e0)" }}>
                      {entry.msg}
                    </span>
                    {meta && (
                      <span
                        className="text-[10px] truncate"
                        style={{ color: "var(--text-muted, #666)" }}
                        title={meta}
                      >
                        {meta}
                      </span>
                    )}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </>
  );
}
