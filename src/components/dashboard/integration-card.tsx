"use client";

import { cn } from "@/lib/utils";
import { glassCard } from "@/lib/styles";

// ── Types ───────────────────────────────────────────────

export interface IntegrationStatus {
  connected: boolean;
  login?: string;
  avatarUrl?: string;
  owner?: string;
  repo?: string;
  email?: string;
  siteName?: string;
  projectKey?: string;
  projectId?: string;
}

export interface IntegrationCardProps {
  service: "github" | "jira" | "vercel";
  title: string;
  description: string;
  icon: React.ReactNode;
  status: IntegrationStatus;
  accentColor: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onSelectResource: () => void;
  connecting?: boolean;
}

// ── Component ───────────────────────────────────────────

export function IntegrationCard({
  service,
  title,
  description,
  icon,
  status,
  accentColor,
  onConnect,
  onDisconnect,
  onSelectResource,
  connecting,
}: IntegrationCardProps) {
  const bgAccent = `${accentColor}14`; // ~8% opacity hex
  const borderAccent = `${accentColor}33`; // ~20% opacity hex

  const resourceLabel =
    service === "github" && status.owner && status.repo
      ? `${status.owner}/${status.repo}`
      : service === "jira" && status.projectKey
        ? status.projectKey
        : null;

  const needsResource =
    status.connected &&
    ((service === "github" && !status.repo) ||
      (service === "jira" && !status.projectKey));

  return (
    <div
      className={cn(
        glassCard,
        "group p-5 flex flex-col gap-4 transition-all duration-200 relative overflow-hidden",
        status.connected
          ? "hover:shadow-[0_0_24px_rgba(34,197,94,0.06)]"
          : "hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
      )}
      style={{
        borderLeft: status.connected
          ? `3px solid ${accentColor}`
          : undefined,
        borderColor: status.connected ? borderAccent : undefined,
        boxShadow: status.connected
          ? `0 0 0 1px ${accentColor}10`
          : undefined,
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          {/* Icon */}
          <div
            className={cn(
              "size-12 rounded-xl flex items-center justify-center shrink-0 transition-shadow duration-200",
              status.connected && "group-hover:shadow-[0_0_16px_rgba(34,197,94,0.12)]"
            )}
            style={{
              backgroundColor: status.connected ? bgAccent : "var(--surface-raised)",
              border: status.connected ? `1px solid ${borderAccent}` : "1px solid var(--surface-border)",
            }}
          >
            {icon}
          </div>

          {/* Title & description */}
          <div>
            <h3 className="text-[0.9rem] font-semibold text-[var(--text)] transition-colors duration-200 group-hover:text-[#22c55e]">
              {title}
            </h3>
            <p className="text-[0.75rem] text-[var(--text-muted)] mt-0.5">
              {description}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div
          className={cn(
            "flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full border",
            status.connected
              ? "bg-[rgba(34,197,94,0.08)] border-[rgba(34,197,94,0.2)]"
              : "bg-[var(--surface-raised)] border-[var(--surface-border)] opacity-50"
          )}
        >
          <div
            className={cn(
              "rounded-full",
              status.connected ? "size-2" : "size-1.5"
            )}
            style={{
              backgroundColor: status.connected
                ? "#22c55e"
                : "var(--text-muted)",
              boxShadow: status.connected
                ? "0 0 6px rgba(34, 197, 94, 0.4)"
                : "none",
              animation: status.connected
                ? "glow-pulse 2.4s ease-in-out infinite"
                : "none",
              ["--glow-color" as string]: "rgba(34, 197, 94, 0.25)",
            }}
          />
          <span
            className={cn(
              "text-[0.7rem]",
              status.connected ? "font-semibold" : "font-medium text-[0.68rem]"
            )}
            style={{
              color: status.connected ? "#22c55e" : "var(--text-muted)",
            }}
          >
            {status.connected ? "Connected" : "Not connected"}
          </span>
        </div>
      </div>

      {/* Connected user info */}
      {status.connected && (
        <div
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl"
          style={{
            backgroundColor: bgAccent,
            border: `1px solid ${borderAccent}`,
          }}
        >
          {status.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={status.avatarUrl}
              alt=""
              className="size-8 rounded-full shrink-0"
              style={{
                boxShadow: `0 0 0 2px ${accentColor}30`,
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            {status.login && (
              <p className="text-[0.8rem] font-semibold text-[var(--text)] truncate">
                @{status.login}
              </p>
            )}
            {status.email && !status.login && (
              <p className="text-[0.8rem] font-semibold text-[var(--text)] truncate">
                {status.email}
              </p>
            )}
            {status.siteName && (
              <p className="text-[0.7rem] text-[var(--text-muted)] truncate">
                {status.siteName}
              </p>
            )}
          </div>

          {/* Resource chip */}
          {resourceLabel && (
            <span
              className="shrink-0 text-[0.7rem] font-medium px-2.5 py-1 rounded-lg truncate max-w-[180px]"
              style={{
                backgroundColor: bgAccent,
                border: `1px solid ${accentColor}28`,
                color: accentColor,
              }}
            >
              {resourceLabel}
            </span>
          )}
        </div>
      )}

      {/* Needs resource warning */}
      {needsResource && (
        <div className="px-3 py-2 rounded-lg bg-[rgba(234,179,8,0.06)] border border-[rgba(234,179,8,0.15)] text-[0.75rem] text-[#eab308]">
          No {service === "github" ? "repository" : "project"} selected —
          choose one to get started
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto">
        {!status.connected ? (
          <button
            onClick={onConnect}
            disabled={connecting}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[0.8rem] font-medium transition-all duration-150 cursor-pointer",
              "text-white disabled:opacity-50",
              "bg-gradient-to-br from-[#22c55e] to-[#16a34a] shadow-[0_2px_16px_rgba(34,197,94,0.25)]",
              "hover:shadow-[0_0_32px_rgba(34,197,94,0.35)] hover:from-[#16a34a] hover:to-[#15803d]",
              "active:scale-[0.98]"
            )}
          >
            {connecting ? (
              <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            )}
            Connect {title}
          </button>
        ) : (
          <>
            {/* Select / Change resource */}
            {(service === "github" || service === "jira") && (
              <button
                onClick={onSelectResource}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[0.78rem] font-medium border border-[var(--surface-border)] bg-[var(--surface-raised)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] hover:border-[var(--border-focus)] transition-all cursor-pointer active:scale-[0.98]"
              >
                <svg
                  width={13}
                  height={13}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {resourceLabel
                  ? `Change ${service === "github" ? "Repo" : "Project"}`
                  : `Select ${service === "github" ? "Repository" : "Project"}`}
              </button>
            )}

            {/* Disconnect */}
            <button
              onClick={onDisconnect}
              disabled={connecting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[0.78rem] font-medium border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.06)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.12)] transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              {connecting ? (
                <span className="size-3 border-2 border-red-300/30 border-t-red-400 rounded-full animate-spin" />
              ) : (
                <svg
                  width={13}
                  height={13}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
              Disconnect
            </button>
          </>
        )}
      </div>
    </div>
  );
}
