"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { ChatInput } from "@/components/chat-input";
import { AgentPipeline } from "@/components/agent-pipeline";
import { DetailPanel } from "@/components/detail-panel";
import { KanbanBoard } from "@/components/kanban-board";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { textGradientTitle } from "@/lib/styles";
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
  isError?: boolean;
}

function AgentToast({ toast, onDone, onClick }: { toast: Toast; onDone: () => void; onClick: () => void }) {
  const isErr = toast.isError;
  const color = isErr ? "#ef4444" : (AGENT_COLORS[toast.agent] ?? "#888");

  useEffect(() => {
    const timer = setTimeout(onDone, isErr ? 5000 : 3500);
    return () => clearTimeout(timer);
  }, [onDone, isErr]);

  return (
    <div
      onClick={() => { onClick(); onDone(); }}
      className="flex items-center gap-[0.6rem] px-3.5 py-2 rounded-[10px] bg-[var(--panel-bg)] backdrop-blur-[16px] [-webkit-backdrop-filter:blur(16px)] animate-toast-in max-w-[300px] cursor-pointer pointer-events-auto transition-transform hover:scale-[1.02]"
      style={{
        border: `1px solid ${color}30`,
        borderLeft: `3px solid ${color}`,
        boxShadow: `0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px ${color}10`,
      }}
    >
      {isErr ? (
        <svg width={14} height={14} viewBox="0 0 16 16" fill="none" className="shrink-0">
          <circle cx="8" cy="8" r="7" fill={`${color}20`} />
          <line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width={14} height={14} viewBox="0 0 16 16" fill="none" className="shrink-0">
          <circle cx="8" cy="8" r="7" fill={`${color}20`} />
          <polyline points="5,8 7.2,10.5 11,5.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      )}
      <div className="min-w-0">
        <div className="text-[0.72rem] font-semibold" style={{ color: isErr ? color : "var(--text)" }}>
          {isErr ? `${formatAgentName(toast.agent)} failed` : formatAgentName(toast.agent)}
        </div>
        <div className="text-[0.62rem] text-[var(--text-muted)] overflow-hidden text-ellipsis whitespace-nowrap">
          {toast.summary}
        </div>
      </div>
    </div>
  );
}

// ── Error helpers ────────────────────────────────────

function classifyError(msg: string): { title: string; hint: string } {
  const lower = msg.toLowerCase();
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("failed to fetch") || lower.includes("aborterror")) {
    return { title: "Connection failed", hint: "Check your internet connection and try again." };
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return { title: "Request timed out", hint: "The server took too long to respond. Try a simpler request." };
  }
  if (lower.includes("429") || lower.includes("rate limit")) {
    return { title: "Rate limited", hint: "Too many requests. Please wait a moment and try again." };
  }
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("api key")) {
    return { title: "Authentication error", hint: "The server API key may be misconfigured." };
  }
  if (lower.includes("500") || lower.includes("internal server")) {
    return { title: "Server error", hint: "Something went wrong on the server. Check the logs." };
  }
  return { title: "Something went wrong", hint: msg };
}

// ── Error banner component ───────────────────────────

function ErrorBanner({ message, onRetry, onDismiss }: { message: string; onRetry?: () => void; onDismiss: () => void }) {
  const { title, hint } = classifyError(message);

  return (
    <div className="mx-5 mb-2 px-3.5 py-[0.65rem] rounded-[10px] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.18)] flex items-start gap-[0.6rem] animate-slide-in">
      <div className="size-7 rounded-full bg-[rgba(239,68,68,0.12)] flex items-center justify-center shrink-0 mt-px">
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.8" />
          <line x1="12" y1="8" x2="12" y2="13" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="1.2" fill="#ef4444" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[0.78rem] font-semibold text-[var(--error)] mb-0.5">{title}</div>
        <div className="text-[0.72rem] text-[var(--text-muted)] leading-[1.4] break-words">{hint}</div>
      </div>
      <div className="flex items-center gap-[0.35rem] shrink-0">
        {onRetry && (
          <button
            className="px-[0.55rem] py-1 rounded-md border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.06)] text-[var(--error)] text-[0.68rem] font-medium cursor-pointer transition-all duration-150 whitespace-nowrap hover:bg-[rgba(239,68,68,0.12)]"
            onClick={onRetry}
          >
            Retry
          </button>
        )}
        <button
          className="p-[0.2rem] rounded border-none bg-transparent text-[var(--text-muted)] cursor-pointer flex items-center justify-center transition-colors duration-150 hover:text-[var(--error)]"
          onClick={onDismiss}
        >
          <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
            <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
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
  const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const heroTextareaRef = useRef<HTMLTextAreaElement>(null);

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
    setShowKanban(false);
    setLastMessage(message);
    setDismissedErrors(new Set());

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
              {
                const errToast: Toast = {
                  id: crypto.randomUUID(),
                  agent: event.agent,
                  summary: event.message.slice(0, 80),
                  isError: true,
                };
                setToasts((prev) => [...prev, errToast]);
              }
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
    <div className="w-full h-screen flex flex-col overflow-hidden">
      {/* ── Top bar ──────────────────────────────────── */}
      {hasPipeline && (
        <div className="flex items-center gap-3 px-5 py-[0.65rem] border-b border-[var(--panel-border)] bg-[var(--topbar-bg)] backdrop-blur-[16px] [-webkit-backdrop-filter:blur(16px)] z-20 shrink-0">
          <div className="flex items-center gap-2 shrink-0">
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
            <span className={`text-base font-bold font-[var(--font-display)] ${textGradientTitle}`}>AI Team</span>
          </div>
          <span className="text-[0.76rem] text-[var(--text-muted)] flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
            {latestEntry?.plan ?? "Planning..."}
          </span>
          <button
            className={cn(
              "px-[0.65rem] py-[0.3rem] rounded-lg border text-[0.73rem] cursor-pointer font-medium transition-all duration-150 flex items-center gap-[0.3rem] shrink-0",
              showKanban
                ? "bg-[var(--accent-glow)] text-[var(--accent)] border-[var(--accent)]"
                : "bg-[var(--surface-hover)] text-[var(--text-muted)] border-[var(--surface-border)]"
            )}
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
      <div className="flex-1 relative overflow-hidden">
        {/* Hero empty state */}
        {!hasPipeline && !isWaitingForPlan && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="absolute top-4 right-4">
              <ThemeToggle />
            </div>

            {/* Icon */}
            <div style={{ animation: "hero-fade-in 0.5s ease-out both", animationDelay: "0s" }}>
              <svg width={48} height={48} viewBox="0 0 24 24" fill="none">
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
            </div>

            {/* Title */}
            <h1
              className={`text-[1.75rem] font-bold font-[var(--font-display)] tracking-[-0.02em] ${textGradientTitle}`}
              style={{ animation: "hero-fade-in 0.5s ease-out both", animationDelay: "0.05s" }}
            >
              AI Team
            </h1>

            {/* Subtitle */}
            <p
              className="text-[0.95rem] text-[var(--text-muted)] max-w-[440px] text-center leading-normal"
              style={{ animation: "hero-fade-in 0.5s ease-out both", animationDelay: "0.1s" }}
            >
              Your AI-powered dev team that plans, builds, tests, and deploys.
            </p>

            {/* Input */}
            <div
              className="w-full max-w-[600px] px-6 mt-2"
              style={{ animation: "hero-fade-in 0.5s ease-out both", animationDelay: "0.15s" }}
            >
              <ChatInput onSubmit={handleSubmit} disabled={isLoading} loading={isLoading} textareaRef={heroTextareaRef} />
            </div>

            {/* Suggestion chips */}
            <div
              className="flex flex-wrap justify-center gap-[0.4rem] max-w-[560px] px-6"
              style={{ animation: "hero-fade-in 0.5s ease-out both", animationDelay: "0.25s" }}
            >
              {[
                "Build a landing page with auth",
                "Fix the checkout flow bug",
                "Add dark mode support",
                "Deploy to production",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    if (heroTextareaRef.current) {
                      heroTextareaRef.current.value = suggestion;
                      heroTextareaRef.current.focus();
                    }
                  }}
                  disabled={isLoading}
                  className="px-[0.7rem] py-[0.3rem] rounded-full border border-[var(--surface-border)] bg-[var(--surface-hover)] text-[var(--text-muted)] text-[0.7rem] cursor-pointer transition-all duration-150 whitespace-nowrap hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-glow)]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading transition */}
        {isWaitingForPlan && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="absolute top-4 right-4">
              <ThemeToggle />
            </div>

            {/* Orbiting dots */}
            <div
              className="relative size-20"
              style={{ animation: "hero-fade-in 0.4s ease-out both" }}
            >
              <div className="absolute inset-0 animate-orbit-spin">
                {ORBIT_COLORS.map((color, i) => {
                  const angle = (i / ORBIT_COLORS.length) * 360;
                  const rad = (angle * Math.PI) / 180;
                  const x = 40 + 30 * Math.cos(rad) - 6;
                  const y = 40 + 30 * Math.sin(rad) - 6;
                  return (
                    <div
                      key={i}
                      className="absolute size-3 rounded-full"
                      style={{
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
              className="text-[0.95rem] text-[var(--text-muted)] text-center animate-hero-fade-in"
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
            onSelectAgent={(agent) => {
              setSelectedAgent(agent);
            }}
          />
        )}

        {/* Kanban overlay */}
        {showKanban && (
          <KanbanBoard tasks={allTasks} onClose={() => setShowKanban(false)} />
        )}

        {/* Detail panel */}
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

        {/* Bottom bar */}
        {hasPipeline && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 border border-[var(--glass-border)] rounded-[14px] bg-[var(--topbar-bg)] backdrop-blur-[20px] [-webkit-backdrop-filter:blur(20px)] shadow-[0_4px_24px_rgba(0,0,0,0.15)] z-[90]"
            style={{ width: "min(720px, calc(100% - 2rem))" }}
          >
            <span className="text-[0.65rem] text-[var(--text-muted)] whitespace-nowrap shrink-0">
              {isLoading
                ? `Working... (${latestEntry?.workingAgents.map((a) => a.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")).join(", ") || "planning"})`
                : latestEntry?.done
                  ? "Pipeline complete"
                  : "Ready"}
            </span>
            <div className="flex-1 min-w-0">
              <ChatInput onSubmit={handleSubmit} disabled={isLoading} loading={isLoading} compact />
            </div>
            <span className="text-[0.6rem] text-[var(--text-muted)] whitespace-nowrap shrink-0 opacity-60">
              {"\u2318"} Enter
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {latestEntry?.error && !dismissedErrors.has(latestEntry.id) && (
        <ErrorBanner
          message={latestEntry.error}
          onRetry={lastMessage ? () => handleSubmit(lastMessage) : undefined}
          onDismiss={() => setDismissedErrors((prev) => new Set(prev).add(latestEntry.id))}
        />
      )}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 left-4 flex flex-col-reverse gap-[0.4rem] z-[100] pointer-events-none">
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
