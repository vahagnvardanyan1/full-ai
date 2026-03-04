"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  IntegrationCard,
  type IntegrationStatus,
} from "@/components/dashboard/integration-card";
import { SelectorModal } from "@/components/dashboard/selector-modal";
import { textGradientTitle, glassCard } from "@/lib/styles";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────

interface AllStatuses {
  github: IntegrationStatus;
  jira: IntegrationStatus;
  vercel: IntegrationStatus;
}

interface Repo {
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  description: string | null;
}

interface JiraProject {
  key: string;
  name: string;
  id: string;
}

type ServiceKey = "github" | "jira" | "vercel";

const DEFAULT_STATUS: IntegrationStatus = { connected: false };

// ── Service config ──────────────────────────────────────

const SERVICES: {
  key: ServiceKey;
  title: string;
  description: string;
  accentColor: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "github",
    title: "GitHub",
    description: "Create issues, pull requests, and commit generated code",
    accentColor: "#8b5cf6",
    icon: (
      <svg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="currentColor"
        style={{ color: "#8b5cf6" }}
      >
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  {
    key: "jira",
    title: "Jira",
    description: "Create and manage issues with full lifecycle transitions",
    accentColor: "#2684ff",
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient
            id="jira-grad-1"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#2684ff" />
            <stop offset="100%" stopColor="#0052cc" />
          </linearGradient>
        </defs>
        <path
          d="M11.53 2c0 3.58 2.91 6.49 6.49 6.49h1.45v1.42c0 3.58 2.91 6.49 6.49 6.49V2.51A.51.51 0 0 0 25.45 2H11.53z"
          fill="url(#jira-grad-1)"
          transform="scale(0.82) translate(-2, 0)"
        />
        <path
          d="M8.12 5.45c-.03 3.58 2.86 6.52 6.44 6.55h1.47v1.42c0 3.58 2.91 6.49 6.49 6.49V5.97a.51.51 0 0 0-.51-.52H8.12z"
          fill="url(#jira-grad-1)"
          opacity="0.8"
          transform="scale(0.82) translate(-2, 0)"
        />
        <path
          d="M4.72 8.9c-.03 3.58 2.86 6.52 6.44 6.55h1.47v1.42c0 3.58 2.91 6.49 6.49 6.49V9.42a.51.51 0 0 0-.51-.52H4.72z"
          fill="url(#jira-grad-1)"
          opacity="0.6"
          transform="scale(0.82) translate(-2, 0)"
        />
      </svg>
    ),
  },
  {
    key: "vercel",
    title: "Vercel",
    description: "Trigger production and preview deployments",
    accentColor: "var(--text)",
    icon: (
      <svg
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="currentColor"
        style={{ color: "var(--text)" }}
      >
        <path d="M12 1L24 22H0L12 1z" />
      </svg>
    ),
  },
];

// ── Skeleton card ────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className={cn(glassCard, "p-5 flex flex-col gap-4")}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          <div className="size-12 rounded-xl bg-[var(--surface-raised)] animate-pulse" />
          <div className="flex flex-col gap-2">
            <div className="h-4 w-24 rounded bg-[var(--surface-raised)] animate-pulse" />
            <div className="h-3 w-52 rounded bg-[var(--surface-raised)] animate-pulse" />
          </div>
        </div>
        <div className="h-6 w-24 rounded-full bg-[var(--surface-raised)] animate-pulse" />
      </div>
      <div className="h-10 w-32 rounded-xl bg-[var(--surface-raised)] animate-pulse mt-auto" />
    </div>
  );
}

// ── Page ────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [statuses, setStatuses] = useState<AllStatuses>({
    github: DEFAULT_STATUS,
    jira: DEFAULT_STATUS,
    vercel: DEFAULT_STATUS,
  });
  const [loaded, setLoaded] = useState(false);
  const [connectingService, setConnectingService] = useState<ServiceKey | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Selector modal state
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorTitle, setSelectorTitle] = useState("");
  const [selectorItems, setSelectorItems] = useState<
    { id: string; label: string; description?: string; badge?: string }[]
  >([]);
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [selectorService, setSelectorService] = useState<ServiceKey | null>(
    null
  );

  // ── Fetch statuses ──────────────────────────────────

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) {
        const data = await res.json();
        setStatuses(data);
      }
    } catch {
      // Silently fail — cards show disconnected
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  // Track which service just completed OAuth so we can
  // open the right selector immediately after fetchStatuses.
  const justConnectedRef = useRef<ServiceKey | null>(null);

  // ── OAuth connect ──────────────────────────────────

  const handleConnect = useCallback(
    (service: ServiceKey) => {
      setConnectingService(service);
      setError(null);

      const popup = window.open(
        `/api/auth/${service}`,
        `${service}-oauth`,
        "width=600,height=700,scrollbars=yes"
      );

      let checkClosed: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        if (checkClosed) {
          clearInterval(checkClosed);
          checkClosed = null;
        }
        window.removeEventListener("message", handleMessage);
      };

      const handleMessage = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;

        const data = e.data;
        if (data?.type === `${service}-connected`) {
          popup?.close();
          setConnectingService(null);
          cleanup();
          justConnectedRef.current = service;
          fetchStatuses();
        } else if (data?.type === `${service}-error`) {
          popup?.close();
          setConnectingService(null);
          setError(data.error ?? "Connection failed");
          cleanup();
        }
      };

      window.addEventListener("message", handleMessage);

      checkClosed = setInterval(() => {
        if (popup?.closed) {
          cleanup();
          setConnectingService(null);
        }
      }, 1000);
    },
    [fetchStatuses]
  );

  // ── Disconnect ──────────────────────────────────────

  const handleDisconnect = useCallback(
    async (service: ServiceKey) => {
      setConnectingService(service);
      try {
        await fetch(`/api/integrations?service=${service}`, {
          method: "DELETE",
        });
        setError(null);
        fetchStatuses();
      } catch {
        setError("Failed to disconnect");
      } finally {
        setConnectingService(null);
      }
    },
    [fetchStatuses]
  );

  // ── Resource selectors ──────────────────────────────

  const openGithubSelector = useCallback(async () => {
    setSelectorService("github");
    setSelectorTitle("Select a Repository");
    setSelectorItems([]);
    setSelectorLoading(true);
    setSelectorOpen(true);

    try {
      const res = await fetch("/api/integrations/github/repos");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load repositories");
        setSelectorOpen(false);
        return;
      }
      if (data.repos?.length) {
        setSelectorItems(
          data.repos.map((r: Repo) => ({
            id: `${r.owner}/${r.name}`,
            label: r.fullName,
            description: r.description || undefined,
            badge: r.private ? "private" : undefined,
          }))
        );
      }
    } catch {
      setError("Failed to load repositories");
      setSelectorOpen(false);
    } finally {
      setSelectorLoading(false);
    }
  }, []);

  const openJiraSelector = useCallback(async () => {
    setSelectorService("jira");
    setSelectorTitle("Select a Project");
    setSelectorItems([]);
    setSelectorLoading(true);
    setSelectorOpen(true);

    try {
      const res = await fetch("/api/integrations/jira/projects");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load projects");
        setSelectorOpen(false);
        return;
      }
      if (data.projects?.length) {
        setSelectorItems(
          data.projects.map((p: JiraProject) => ({
            id: p.key,
            label: p.key,
            description: p.name,
          }))
        );
      }
    } catch {
      setError("Failed to load projects");
      setSelectorOpen(false);
    } finally {
      setSelectorLoading(false);
    }
  }, []);

  const handleSelectorSelect = useCallback(
    async (id: string) => {
      if (selectorService === "github") {
        const [owner, repo] = id.split("/");
        await fetch("/api/integrations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service: "github", owner, repo }),
        });
      } else if (selectorService === "jira") {
        await fetch("/api/integrations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service: "jira", projectKey: id }),
        });
      }
      setSelectorOpen(false);
      fetchStatuses();
    },
    [selectorService, fetchStatuses]
  );

  const handleSelectResource = useCallback(
    (service: ServiceKey) => {
      if (service === "github") openGithubSelector();
      else if (service === "jira") openJiraSelector();
    },
    [openGithubSelector, openJiraSelector]
  );

  // Auto-open selector for the service that just connected via OAuth
  useEffect(() => {
    if (!loaded || selectorOpen) return;

    const service = justConnectedRef.current;
    if (!service) return;

    const gh = statuses.github;
    const jira = statuses.jira;

    if (service === "github" && gh.connected && !gh.repo) {
      justConnectedRef.current = null;
      const timer = setTimeout(() => openGithubSelector(), 300);
      return () => clearTimeout(timer);
    }
    if (service === "jira" && jira.connected && !jira.projectKey) {
      justConnectedRef.current = null;
      const timer = setTimeout(() => openJiraSelector(), 300);
      return () => clearTimeout(timer);
    }
  }, [loaded, statuses.github, statuses.jira, selectorOpen, openGithubSelector, openJiraSelector]);

  // ── Derived data ────────────────────────────────────

  const connectedServices = SERVICES.filter(
    (s) => statuses[s.key].connected
  );
  const availableServices = SERVICES.filter(
    (s) => !statuses[s.key].connected
  );
  const connectedCount = connectedServices.length;
  const totalCount = SERVICES.length;
  const isPartiallyConnected = connectedCount > 0 && connectedCount < totalCount;

  // ── Render ──────────────────────────────────────────

  if (!loaded) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl">
        <div className="mb-8">
          <div className="h-7 w-40 rounded bg-[var(--surface-raised)] animate-pulse mb-3" />
          <div className="h-4 w-96 rounded bg-[var(--surface-raised)] animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className={`text-2xl font-bold ${textGradientTitle}`}>
          Integrations
        </h1>
        <p className="text-[0.85rem] text-[var(--text-muted)] mt-2 max-w-2xl leading-relaxed">
          Connect your tools to enable real GitHub issues, Jira tickets, and
          Vercel deployments. Agents use these integrations to generate code,
          track work, and ship automatically.
        </p>
      </div>

      {/* Summary stats */}
      <div
        className={cn(
          glassCard,
          "px-5 py-3.5 mb-6 flex items-center justify-between gap-4"
        )}
      >
        {/* Left: counter with icon */}
        <div className="flex items-center gap-3">
          <div
            className="size-8 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.15)",
            }}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[0.95rem] font-bold text-[var(--text)]">
              {connectedCount}/{totalCount}
            </span>
            <span className="text-[0.78rem] text-[var(--text-muted)]">
              connected
            </span>
          </div>
        </div>

        {/* Separator */}
        <div className="h-6 border-r border-[var(--surface-border)]" />

        {/* Right: per-service indicators */}
        <div className="flex items-center gap-2">
          {SERVICES.map((s) => {
            const isConn = statuses[s.key].connected;
            return (
              <div
                key={s.key}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.72rem] font-medium transition-colors duration-300",
                  isConn
                    ? "bg-[rgba(34,197,94,0.08)] text-[#22c55e]"
                    : "text-[var(--text-muted)] opacity-50"
                )}
              >
                <div
                  className="size-1.5 rounded-full"
                  style={{
                    backgroundColor: isConn
                      ? "#22c55e"
                      : "var(--text-muted)",
                    boxShadow: isConn
                      ? "0 0 6px rgba(34, 197, 94, 0.3)"
                      : "none",
                  }}
                />
                {s.title}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-[0.8rem] text-[#ef4444] flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-[#ef4444] hover:text-[#dc2626] cursor-pointer ml-3"
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>
      )}

      {/* Help banner — only when partially connected */}
      {isPartiallyConnected && (
        <div
          className="mb-5 px-4 py-3 rounded-xl bg-[var(--surface-raised)] text-[0.8rem] text-[var(--text-muted)] leading-relaxed"
          style={{ borderLeft: "3px solid rgba(34,197,94,0.4)" }}
        >
          Connect all three services to unlock full agent capabilities — code
          generation, issue tracking, and automated deployments.
        </div>
      )}

      {/* Connected section */}
      {connectedServices.length > 0 && (
        <div className="mb-6">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] mb-3 px-1">
            Connected
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {connectedServices.map((s, i) => (
              <div
                key={s.key}
                style={{
                  animation: `slide-in 350ms ease ${i * 80}ms both`,
                }}
              >
                <IntegrationCard
                  service={s.key}
                  title={s.title}
                  description={s.description}
                  icon={s.icon}
                  status={statuses[s.key]}
                  accentColor={s.accentColor}
                  onConnect={() => handleConnect(s.key)}
                  onDisconnect={() => handleDisconnect(s.key)}
                  onSelectResource={() => handleSelectResource(s.key)}
                  connecting={connectingService === s.key}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available section */}
      {availableServices.length > 0 && (
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] mb-3 px-1">
            Available
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {availableServices.map((s, i) => (
              <div
                key={s.key}
                style={{
                  animation: `slide-in 350ms ease ${(connectedServices.length * 80) + 100 + (i * 80)}ms both`,
                }}
              >
                <IntegrationCard
                  service={s.key}
                  title={s.title}
                  description={s.description}
                  icon={s.icon}
                  status={statuses[s.key]}
                  accentColor={s.accentColor}
                  onConnect={() => handleConnect(s.key)}
                  onDisconnect={() => handleDisconnect(s.key)}
                  onSelectResource={() => handleSelectResource(s.key)}
                  connecting={connectingService === s.key}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selector modal */}
      <SelectorModal
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        title={selectorTitle}
        items={selectorItems}
        loading={selectorLoading}
        onSelect={handleSelectorSelect}
        service={selectorService ?? undefined}
      />
    </div>
  );
}
