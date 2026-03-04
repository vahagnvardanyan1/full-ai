"use client";

import { useState, useCallback, CSSProperties, useMemo, useEffect } from "react";
import { ChatInput } from "@/components/chat-input";
import { AgentPipeline } from "@/components/agent-pipeline";
import { DetailPanel } from "@/components/detail-panel";
import { KanbanBoard } from "@/components/kanban-board";
import { ThemeToggle } from "@/components/theme-toggle";
import type {
  AgentRole,
  AgentResponse,
  TaskItem,
  GeneratedFile,
  StreamEvent,
} from "@/lib/agents/types";

// ── Types ────────────────────────────────────────────────

interface AgentOutput {
  response: AgentResponse;
  tasks: TaskItem[];
  files: GeneratedFile[];
}

interface HistoryEntry {
  id: string;
  userMessage: string;
  plan: string | null;
  phases: AgentRole[][] | null;
  workingAgents: string[];
  outputs: AgentOutput[];
  error: string | null;
  done: boolean;
}

// ── Styles ───────────────────────────────────────────────

const pageWrapper: CSSProperties = {
  width: "100%",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const topBar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.65rem 1.25rem",
  borderBottom: "1px solid var(--panel-border)",
  background: "var(--topbar-bg)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  zIndex: 20,
  flexShrink: 0,
};

const logoArea: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexShrink: 0,
};

const logoText: CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  fontFamily: "var(--font-display)",
  background: "linear-gradient(135deg, var(--gradient-title-from), var(--gradient-title-to))",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

const planText: CSSProperties = {
  fontSize: "0.76rem",
  color: "var(--text-muted)",
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
};

const mainArea: CSSProperties = {
  flex: 1,
  position: "relative",
  overflow: "hidden",
};

const heroEmpty: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5rem",
};

const heroTitle: CSSProperties = {
  fontSize: "2.5rem",
  fontWeight: 700,
  fontFamily: "var(--font-display)",
  background: "linear-gradient(135deg, var(--gradient-title-from), var(--gradient-title-to))",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  letterSpacing: "-0.02em",
};

const heroSub: CSSProperties = {
  fontSize: "0.95rem",
  color: "var(--text-muted)",
  maxWidth: 440,
  textAlign: "center",
  lineHeight: 1.5,
};

const heroInputWrap: CSSProperties = {
  width: "100%",
  maxWidth: 600,
  padding: "0 1.5rem",
};

const bottomBar: CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(720px, calc(100% - 2rem))",
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.5rem 1rem",
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  background: "var(--topbar-bg)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
  zIndex: 90,
};

const errorBanner: CSSProperties = {
  margin: "0 1.25rem 0.5rem",
  padding: "0.5rem 0.75rem",
  borderRadius: 8,
  background: "rgba(239, 68, 68, 0.08)",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  color: "var(--error)",
  fontSize: "0.8rem",
};

const toolbarBtn: CSSProperties = {
  padding: "0.3rem 0.65rem",
  borderRadius: 8,
  border: "1px solid var(--surface-border)",
  background: "var(--surface-hover)",
  color: "var(--text-muted)",
  fontSize: "0.73rem",
  cursor: "pointer",
  fontWeight: 500,
  transition: "all 0.15s",
  display: "flex",
  alignItems: "center",
  gap: "0.3rem",
  flexShrink: 0,
};

// ── Loading messages ─────────────────────────────────────

const LOADING_MESSAGES = [
  "Analyzing your request...",
  "Assembling your AI team...",
  "Planning the pipeline...",
];

const ORBIT_COLORS = ["#a78bfa", "#34d399", "#eab308", "#f97316"];

const AGENT_COLORS: Record<string, string> = {
  product_manager: "#a78bfa",
  frontend_developer: "#34d399",
  qa: "#facc15",
  devops: "#f97316",
  orchestrator: "#60a5fa",
};

function formatAgentName(role: string): string {
  return role.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ── Toast ────────────────────────────────────────────────

interface Toast {
  id: string;
  agent: string;
  summary: string;
}

function AgentToast({ toast, onDone, onClick }: { toast: Toast; onDone: () => void; onClick: () => void }) {
  const color = AGENT_COLORS[toast.agent] ?? "#888";

  useEffect(() => {
    const timer = setTimeout(onDone, 3500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      onClick={() => { onClick(); onDone(); }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        padding: "0.5rem 0.85rem",
        borderRadius: 10,
        background: "var(--panel-bg)",
        border: `1px solid ${color}30`,
        borderLeft: `3px solid ${color}`,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: `0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px ${color}10`,
        animation: "toast-in 0.3s ease-out",
        maxWidth: 300,
        cursor: "pointer",
        pointerEvents: "auto",
        transition: "transform 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.02)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      <svg width={14} height={14} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="8" r="7" fill={`${color}20`} />
        <polyline points="5,8 7.2,10.5 11,5.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text)" }}>
          {formatAgentName(toast.agent)}
        </div>
        <div
          style={{
            fontSize: "0.62rem",
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {toast.summary}
        </div>
      </div>
    </div>
  );
}

// ── SSE parser ───────────────────────────────────────────

function parseSSE(text: string): StreamEvent[] {
  const events: StreamEvent[] = [];
  for (const block of text.split("\n\n")) {
    const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
    if (dataLine) {
      try { events.push(JSON.parse(dataLine.slice(6)) as StreamEvent); } catch { /* skip */ }
    }
  }
  return events;
}

function mergeTasks(existing: TaskItem[], incoming: TaskItem[]): TaskItem[] {
  const map = new Map<string, TaskItem>();
  for (const t of existing) map.set(t.id, t);
  for (const t of incoming) map.set(t.id, t);
  return Array.from(map.values());
}

// ── Component ────────────────────────────────────────────

export default function Home() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [allTasks, setAllTasks] = useState<TaskItem[]>([]);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showKanban, setShowKanban] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const isLoading = history.some((h) => !h.done && !h.error);
  const latestEntry = [...history].reverse().find((h) => h.phases);

  const completedAgents = latestEntry
    ? latestEntry.outputs.map((o) => o.response.agent)
    : [];

  const agentOutputs = useMemo(() => {
    const map = new Map<string, { response: AgentResponse; tasks: TaskItem[]; files: GeneratedFile[] }>();
    if (latestEntry) {
      for (const output of latestEntry.outputs) {
        map.set(output.response.agent, output);
      }
    }
    return map;
  }, [latestEntry]);

  const selectedOutput = selectedAgent ? agentOutputs.get(selectedAgent) : null;

  function patch(entryId: string, updater: (prev: HistoryEntry) => Partial<HistoryEntry>) {
    setHistory((prev) => prev.map((h) => (h.id === entryId ? { ...h, ...updater(h) } : h)));
  }

  async function handleSubmit(message: string) {
    const entryId = crypto.randomUUID();
    setSelectedAgent(null);

    setHistory((prev) => [
      ...prev,
      { id: entryId, userMessage: message, plan: null, phases: null, workingAgents: [], outputs: [], error: null, done: false },
    ]);

    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lastDoubleNewline = buffer.lastIndexOf("\n\n");
        if (lastDoubleNewline === -1) continue;

        const complete = buffer.slice(0, lastDoubleNewline + 2);
        buffer = buffer.slice(lastDoubleNewline + 2);

        for (const event of parseSSE(complete)) {
          switch (event.type) {
            case "plan":
              patch(entryId, () => ({ plan: event.plan, phases: event.phases }));
              break;
            case "agent_start":
              patch(entryId, (prev) => ({ workingAgents: [...prev.workingAgents, event.agent] }));
              break;
            case "agent_complete":
              patch(entryId, (prev) => ({
                outputs: [...prev.outputs, { response: event.response, tasks: event.tasks, files: event.files }],
                workingAgents: prev.workingAgents.filter((a) => a !== event.response.agent),
              }));
              // Show toast (click to open sidebar)
              {
                const t: Toast = {
                  id: crypto.randomUUID(),
                  agent: event.response.agent,
                  summary: event.response.summary.slice(0, 80).replace(/\n/g, " "),
                };
                setToasts((prev) => [...prev, t]);
              }
              if (event.tasks.length > 0) setAllTasks((prev) => mergeTasks(prev, event.tasks));
              break;
            case "tasks_updated":
              setAllTasks((prev) => mergeTasks(prev, event.tasks));
              break;
            case "error":
              patch(entryId, () => ({ error: event.message }));
              break;
            case "done":
              patch(entryId, () => ({ done: true, workingAgents: [] }));
              break;
          }
        }
      }

      patch(entryId, () => ({ done: true, workingAgents: [] }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patch(entryId, () => ({ error: msg, done: true, workingAgents: [] }));
    }
  }

  const hasPipeline = !!latestEntry?.phases;
  const isWaitingForPlan = isLoading && !hasPipeline;

  // Cycling loading message
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  useEffect(() => {
    if (!isWaitingForPlan) {
      setLoadingMsgIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isWaitingForPlan]);

  return (
    <div style={pageWrapper}>
      {/* ── Top bar ──────────────────────────────────── */}
      {hasPipeline && (
        <div style={topBar}>
          <div style={logoArea}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="var(--accent)" strokeWidth="1.8" />
              <circle cx="12" cy="4" r="1.5" fill="var(--accent)" opacity="0.6" />
              <circle cx="20" cy="12" r="1.5" fill="var(--accent)" opacity="0.6" />
              <circle cx="12" cy="20" r="1.5" fill="var(--accent)" opacity="0.6" />
              <circle cx="4" cy="12" r="1.5" fill="var(--accent)" opacity="0.6" />
              <line x1="12" y1="5.5" x2="12" y2="9" stroke="var(--accent)" strokeWidth="1.2" />
              <line x1="18.5" y1="12" x2="15" y2="12" stroke="var(--accent)" strokeWidth="1.2" />
              <line x1="12" y1="15" x2="12" y2="18.5" stroke="var(--accent)" strokeWidth="1.2" />
              <line x1="5.5" y1="12" x2="9" y2="12" stroke="var(--accent)" strokeWidth="1.2" />
            </svg>
            <span style={logoText}>AI Team</span>
          </div>
          <span style={planText}>{latestEntry?.plan ?? "Planning..."}</span>
          <button
            style={{
              ...toolbarBtn,
              background: showKanban ? "var(--accent-glow)" : "var(--surface-hover)",
              color: showKanban ? "var(--accent)" : "var(--text-muted)",
              borderColor: showKanban ? "var(--accent)" : "var(--surface-border)",
            }}
            onClick={() => setShowKanban((v) => !v)}
          >
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
              <rect x="1" y="2" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="6" y="2" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="11" y="2" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Tasks{allTasks.length > 0 ? ` (${allTasks.length})` : ""}
          </button>
          <ThemeToggle />
        </div>
      )}

      {/* ── Main area ────────────────────────────────── */}
      <div style={mainArea}>
        {/* Hero empty state */}
        {!hasPipeline && !isWaitingForPlan && (
          <div style={heroEmpty}>
            <div style={{ position: "absolute", top: "1rem", right: "1rem" }}>
              <ThemeToggle />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                animation: "hero-fade-in 0.5s ease-out both",
                animationDelay: "0s",
              }}
            >
              <svg width={36} height={36} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3.5" stroke="var(--accent)" strokeWidth="1.5" />
                <circle cx="12" cy="3.5" r="2" fill="#a78bfa" opacity="0.6" />
                <circle cx="20.5" cy="12" r="2" fill="#34d399" opacity="0.6" />
                <circle cx="12" cy="20.5" r="2" fill="#eab308" opacity="0.6" />
                <circle cx="3.5" cy="12" r="2" fill="#f97316" opacity="0.6" />
                <line x1="12" y1="5.5" x2="12" y2="8.5" stroke="#a78bfa" strokeWidth="1" opacity="0.4" />
                <line x1="18.5" y1="12" x2="15.5" y2="12" stroke="#34d399" strokeWidth="1" opacity="0.4" />
                <line x1="12" y1="15.5" x2="12" y2="18.5" stroke="#eab308" strokeWidth="1" opacity="0.4" />
                <line x1="5.5" y1="12" x2="8.5" y2="12" stroke="#f97316" strokeWidth="1" opacity="0.4" />
              </svg>
              <h1 style={heroTitle}>AI Team</h1>
            </div>
            <p
              style={{
                ...heroSub,
                animation: "hero-fade-in 0.5s ease-out both",
                animationDelay: "0.1s",
              }}
            >
              Describe a feature, report a bug, or request a deployment.
              Your AI team will plan, build, test, and deploy.
            </p>
            <div
              style={{
                ...heroInputWrap,
                animation: "hero-fade-in 0.5s ease-out both",
                animationDelay: "0.2s",
              }}
            >
              <ChatInput onSubmit={handleSubmit} disabled={isLoading} loading={isLoading} />
              <p style={{ textAlign: "center", fontSize: "0.66rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                Cmd + Enter to send
              </p>
            </div>
          </div>
        )}

        {/* Loading transition */}
        {isWaitingForPlan && (
          <div style={heroEmpty}>
            <div style={{ position: "absolute", top: "1rem", right: "1rem" }}>
              <ThemeToggle />
            </div>

            {/* Orbiting dots */}
            <div
              style={{
                position: "relative",
                width: 80,
                height: 80,
                animation: "hero-fade-in 0.4s ease-out both",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  animation: "orbit-spin 3s linear infinite",
                }}
              >
                {ORBIT_COLORS.map((color, i) => {
                  const angle = (i / ORBIT_COLORS.length) * 360;
                  const rad = (angle * Math.PI) / 180;
                  const x = 40 + 30 * Math.cos(rad) - 6;
                  const y = 40 + 30 * Math.sin(rad) - 6;
                  return (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: color,
                        left: x,
                        top: y,
                        boxShadow: `0 0 12px ${color}66`,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Cycling status text */}
            <p
              key={loadingMsgIdx}
              style={{
                fontSize: "0.95rem",
                color: "var(--text-muted)",
                animation: "hero-fade-in 0.4s ease-out both",
                textAlign: "center",
              }}
            >
              {LOADING_MESSAGES[loadingMsgIdx]}
            </p>
          </div>
        )}

        {/* Pipeline */}
        {hasPipeline && latestEntry?.phases && (
          <AgentPipeline
            phases={latestEntry.phases}
            workingAgents={latestEntry.workingAgents}
            completedAgents={completedAgents}
            errorAgent={latestEntry.error ? latestEntry.workingAgents[0] : null}
            agentOutputs={agentOutputs}
            selectedAgent={selectedAgent}
            onSelectAgent={setSelectedAgent}
          />
        )}

        {/* Detail panel — auto-opens on agent completion */}
        {selectedOutput && selectedAgent && (
          <DetailPanel
            key={selectedAgent}
            agent={selectedAgent}
            response={selectedOutput.response}
            tasks={selectedOutput.tasks}
            files={selectedOutput.files}
            onClose={() => setSelectedAgent(null)}
          />
        )}

        {/* Kanban overlay */}
        {showKanban && allTasks.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              animation: "panel-slide-in 0.25s ease-out",
            }}
          >
            <KanbanBoard tasks={allTasks} />
          </div>
        )}

        {/* Bottom bar — floating inside main area */}
        {hasPipeline && (
          <div style={bottomBar}>
            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
              {isLoading
                ? `Working... (${latestEntry?.workingAgents.map((a) => a.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")).join(", ") || "planning"})`
                : latestEntry?.done
                  ? "Pipeline complete"
                  : "Ready"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ChatInput onSubmit={handleSubmit} disabled={isLoading} loading={isLoading} compact />
            </div>
            <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0, opacity: 0.6 }}>
              {"\u2318"} Enter
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {latestEntry?.error && <div style={errorBanner}>{latestEntry.error}</div>}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: 16,
            display: "flex",
            flexDirection: "column-reverse",
            gap: "0.4rem",
            zIndex: 100,
            pointerEvents: "none",
          }}
        >
          {toasts.map((t) => (
            <AgentToast
              key={t.id}
              toast={t}
              onDone={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              onClick={() => setSelectedAgent(t.agent)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
