"use client";

import { useState, useEffect, useCallback } from "react";

import { cn } from "@/lib/utils";

interface McpStatus {
  connected: boolean;
  server: string | null;
  toolCount: number;
  healthy: boolean;
  swarm: {
    active: boolean;
    topology: string;
    agentCount: number;
  } | null;
}

const POLL_INTERVAL_MS = 30_000;

export const RufloStatus = () => {
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp/status");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as McpStatus;
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-muted)]">
        <div className="size-2 rounded-full bg-[var(--text-muted)] animate-pulse" />
        <span>Ruflo MCP...</span>
      </div>
    );
  }

  const isConnected = status?.connected && status.healthy;

  return (
    <button
      onClick={fetchStatus}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer",
        "border border-[var(--surface-border)] hover:bg-[var(--surface-hover)]",
        isConnected
          ? "text-[#22c55e]"
          : "text-[var(--text-muted)]",
      )}
      title={
        isConnected
          ? `Ruflo MCP connected — ${status?.toolCount ?? 0} tools available`
          : "Ruflo MCP disconnected — click to retry"
      }
    >
      <div
        className={cn(
          "size-2 rounded-full",
          isConnected ? "bg-[#22c55e]" : "bg-[var(--text-muted)]",
        )}
      />
      <span>
        {isConnected ? `Ruflo (${status?.toolCount ?? 0} tools)` : "Ruflo offline"}
      </span>
    </button>
  );
};
