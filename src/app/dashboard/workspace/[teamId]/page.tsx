"use client";

import { useState, useRef, useMemo, useEffect, useCallback, use } from "react";

import { ChatInput } from "@/components/chat-input";
import { AgentPipeline } from "@/components/agent-pipeline";
import { DetailPanel } from "@/components/detail-panel";
import { KanbanBoard } from "@/components/kanban-board";
import { AgentAvatar } from "@/components/agent-avatar";
import { cn } from "@/lib/utils";
import { useWorkspaceSession } from "@/hooks/use-workspace-session";
import { useRunPolling } from "@/hooks/use-run-polling";
import { WorkflowHistoryPanel } from "@/components/workflow-history-panel";
import type { HistoryEntry, StoredWorkflowRun } from "@/lib/workflow-replay";
import { replayWorkflowRuns } from "@/lib/workflow-replay";
import type {
  AgentRole,
  AgentResponse,
  TaskItem,
  GeneratedFile,
  StreamEvent,
} from "@/lib/agents/types";

const AGENT_COLORS: Record<string, string> = {
  product_manager: "#a78bfa",
  frontend_developer: "#34d399",
  qa: "#facc15",
  devops: "#f97316",
  orchestrator: "#60a5fa",
  fashion_stylist: "#ec4899",
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

// ── Suggestion chips ─────────────────────────────────

const SUGGESTIONS = [
  "Generate landing page",
  "Add dark mode",
  "Write unit tests",
  "Improve performance",
];

function SuggestionChips({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5 px-2 animate-fade-in">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          className="px-2.5 py-1 rounded-full bg-[var(--surface-hover)] text-[var(--text-muted)] text-[0.7rem] cursor-pointer border-none transition-all hover:text-[var(--text)] hover:bg-[var(--glass-border)]"
          onClick={() => onSelect(s)}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ── Error banner component ───────────────────────────

function ErrorBanner({ message, onRetry, onDismiss }: { message: string; onRetry?: () => void; onDismiss: () => void }) {
  const { title, hint } = classifyError(message);

  return (
    <div className="mx-2 sm:mx-5 mb-2 px-3 sm:px-3.5 py-[0.65rem] rounded-[10px] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.18)] flex items-start gap-[0.6rem] animate-slide-in">
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

export default function WorkspaceTeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);

  const { sessionId, isRestoring, restoredHistory, restoredTasks, activeRunRequestId } =
    useWorkspaceSession({ teamId });

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [allTasks, setAllTasks] = useState<TaskItem[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showKanban, setShowKanban] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [githubWarning, setGithubWarning] = useState<string | null>(null);
  // Polling stops once the run completes or goes stale; set to null to stop
  const [pollingRequestId, setPollingRequestId] = useState<string | null>(null);
  // History panel
  const [showHistory, setShowHistory] = useState(false);
  // When set, shows a specific past run instead of the latest
  const [viewingEntryId, setViewingEntryId] = useState<string | null>(null);

  // Restore persisted state once the backend fetch completes
  useEffect(() => {
    if (isRestoring) return;
    if (restoredHistory.length > 0) setHistory(restoredHistory);
    if (restoredTasks.length > 0) setAllTasks(restoredTasks);
    if (activeRunRequestId) setPollingRequestId(activeRunRequestId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestoring]);

  // Live-reconnect to a run that was still executing when the page reloaded
  const handlePollingUpdate = useCallback(
    ({ entry, tasks }: { entry: HistoryEntry; tasks: TaskItem[] }) => {
      setHistory((prev) =>
        prev.some((h) => h.id === entry.id)
          ? prev.map((h) => (h.id === entry.id ? entry : h))
          : [...prev, entry],
      );
      setAllTasks((prev) => mergeTasks(prev, tasks));
    },
    [],
  );

  const handlePollingDone = useCallback(() => {
    setPollingRequestId(null);
  }, []);

  useRunPolling({
    requestId: pollingRequestId,
    onUpdate: handlePollingUpdate,
    onDone: handlePollingDone,
  });

  const checkGitHubStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/github/status");
      const data = await res.json();
      if (!data.ready) {
        setGithubWarning(data.error ?? "GitHub is not connected.");
      } else {
        setGithubWarning(null);
      }
    } catch { /* ignore — non-blocking */ }
  }, []);

  useEffect(() => {
    checkGitHubStatus();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkGitHubStatus();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [checkGitHubStatus]);

  const isLoading = history.some((h) => !h.done && !h.error);
  // If user selected a past run from the history panel, show that; otherwise show the latest
  const latestEntry = viewingEntryId
    ? (history.find((h) => h.id === viewingEntryId) ?? [...history].reverse().find((h) => h.phases))
    : [...history].reverse().find((h) => h.phases);

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

  const patch = (entryId: string, updater: (prev: HistoryEntry) => Partial<HistoryEntry>) => {
    setHistory((prev) => prev.map((h) => (h.id === entryId ? { ...h, ...updater(h) } : h)));
  };

  const followUpRef = useRef<HTMLTextAreaElement>(null);
  const [followUpHasText, setFollowUpHasText] = useState(false);

  const handleSuggestionSelect = useCallback((text: string) => {
    if (followUpRef.current) {
      followUpRef.current.value = text;
      followUpRef.current.focus();
      setFollowUpHasText(true);
    }
  }, []);

  const handleSubmit = async (message: string) => {
    setFollowUpHasText(false);
    if (!sessionId) return;

    // New run uses the live SSE stream — stop polling and reset view to latest
    setPollingRequestId(null);
    setViewingEntryId(null);
    setShowHistory(false);

    const entryId = crypto.randomUUID();
    setSelectedAgent(null);
    setShowKanban(false);
    setLastMessage(message);
    setDismissedErrors(new Set());

    setHistory((prev) => [
      ...prev,
      { id: entryId, userMessage: message, plan: null, phases: null, workingAgents: [], outputs: [], error: null, done: false },
    ]);

    // Pre-flight: check GitHub connection before running pipeline
    try {
      const ghRes = await fetch("/api/integrations/github/status");
      const ghStatus = await ghRes.json();
      if (!ghStatus.ready) {
        setGithubWarning(ghStatus.error ?? "GitHub is not connected.");
        setHistory(prev => [...prev.map(h => h.id === entryId ? { ...h, error: ghStatus.error, done: true } : h)]);
        return;
      }
      setGithubWarning(null);
    } catch { /* non-blocking — proceed if status endpoint unavailable */ }

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

      let doneRequestId: string | null = null;

      const processEvents = (text: string) => {
        for (const event of parseSSE(text)) {
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
                  id: Math.random().toString(36).slice(2) + Date.now().toString(36),
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
                  id: Math.random().toString(36).slice(2) + Date.now().toString(36),
                  agent: event.agent,
                  summary: event.message.slice(0, 80),
                  isError: true,
                };
                setToasts((prev) => [...prev, errToast]);
              }
              break;
            case "done":
              doneRequestId = event.requestId;
              patch(entryId, () => ({ done: true, workingAgents: [] }));
              break;
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lastDoubleNewline = buffer.lastIndexOf("\n\n");
        if (lastDoubleNewline === -1) continue;

        const complete = buffer.slice(0, lastDoubleNewline + 2);
        buffer = buffer.slice(lastDoubleNewline + 2);
        processEvents(complete);
      }

      // Flush any remaining data in the decoder and buffer
      buffer += decoder.decode();
      if (buffer.trim()) processEvents(buffer);

      patch(entryId, () => ({ done: true, workingAgents: [] }));

      // Reconcile final state from MongoDB to catch any SSE events
      // that were lost due to response buffering/compression
      if (doneRequestId) {
        reconcileFromDB(doneRequestId, entryId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patch(entryId, () => ({ error: msg, done: true, workingAgents: [] }));
    }
  }

  const reconcileFromDB = async (requestId: string, entryId: string) => {
    try {
      const res = await fetch(`/api/workflows?id=${encodeURIComponent(requestId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { run?: StoredWorkflowRun };
      if (!data.run) return;

      const { history: replayedHistory, allTasks: replayedTasks } = replayWorkflowRuns([data.run]);
      const replayedEntry = replayedHistory[0];
      if (!replayedEntry) return;

      // Merge the DB state into the live history entry (keep entryId)
      patch(entryId, () => ({
        plan: replayedEntry.plan,
        phases: replayedEntry.phases,
        workingAgents: replayedEntry.workingAgents,
        outputs: replayedEntry.outputs,
        error: replayedEntry.error,
        done: replayedEntry.done,
      }));
      setAllTasks((prev) => mergeTasks(prev, replayedTasks));
    } catch {
      // Non-critical — SSE data is the primary source, this is just a safety net
    }
  };

  const hasPipeline = !!latestEntry?.phases;
  const isWaitingForPlan = isLoading && !hasPipeline;
  const showOrchestrator = !hasPipeline;
  const isInputDisabled = isLoading || isRestoring || !sessionId;

  return (
    <div className={cn("w-full h-[calc(100vh)] flex flex-col overflow-hidden")}>
      {/* ── Top bar ──────────────────────────────────── */}
      {hasPipeline && (
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-[720px]">
          <nav
            className="flex items-center gap-2 sm:gap-3 py-[0.55rem] pl-3 sm:pl-5 pr-[0.5rem] rounded-full border border-[var(--glass-border)] shadow-[0_4px_30px_rgba(0,0,0,0.12)]"
            style={{
              background: "var(--topbar-bg)",
              backdropFilter: "blur(20px) saturate(1.4)",
              WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            }}
          >
            <span className="text-[0.68rem] sm:text-[0.72rem] text-[var(--text-muted)] flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
              {latestEntry?.plan ?? "Planning..."}
            </span>
            {/* Tasks toggle */}
            <button
              className={cn(
                "px-[0.55rem] sm:px-[0.65rem] py-[0.3rem] rounded-full border text-[0.68rem] sm:text-[0.73rem] cursor-pointer font-medium transition-all duration-150 flex items-center gap-[0.3rem] shrink-0",
                showKanban
                  ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e] border-[#22c55e80]"
                  : "bg-[var(--surface-raised)] text-[var(--text-muted)] border-[var(--surface-border)]"
              )}
              onClick={() => setShowKanban((v) => !v)}
            >
              <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
                <rect x="1" y="2" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <rect x="6" y="2" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <rect x="11" y="2" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <span className="hidden sm:inline">Tasks</span>{allTasks.length > 0 ? ` (${allTasks.length})` : ""}
            </button>
            {/* History toggle — only shown when there are multiple runs */}
            {history.length > 1 && (
              <button
                className={cn(
                  "px-[0.55rem] sm:px-[0.65rem] py-[0.3rem] rounded-full border text-[0.68rem] sm:text-[0.73rem] cursor-pointer font-medium transition-all duration-150 flex items-center gap-[0.3rem] shrink-0",
                  showHistory
                    ? "bg-[rgba(167,139,250,0.12)] text-[#a78bfa] border-[#a78bfa60]"
                    : "bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)] border-[rgba(255,255,255,0.08)]"
                )}
                onClick={() => setShowHistory((v) => !v)}
              >
                <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" />
                  <polyline points="8,4.5 8,8 10.2,9.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="hidden sm:inline">History</span>
                <span className="text-[0.6rem] opacity-70">({history.length})</span>
              </button>
            )}
          </nav>

          {/* History panel — anchored below the nav */}
          {showHistory && (
            <WorkflowHistoryPanel
              history={history}
              viewingId={viewingEntryId}
              onSelectRun={setViewingEntryId}
              onClose={() => setShowHistory(false)}
            />
          )}
        </div>
      )}

      {/* History button when no pipeline is visible yet (past runs exist) */}
      {!hasPipeline && history.length > 0 && (
        <div className="absolute top-3.5 right-2 sm:right-4 z-20">
          <button
            className={cn(
              "px-3 py-[0.4rem] rounded-full border text-[0.72rem] cursor-pointer font-medium transition-all duration-150 flex items-center gap-[0.35rem]",
              showHistory
                ? "bg-[rgba(167,139,250,0.12)] text-[#a78bfa] border-[#a78bfa60]"
                : "bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)] border-[rgba(255,255,255,0.1)]"
            )}
            style={{
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
            onClick={() => setShowHistory((v) => !v)}
          >
            <svg width={13} height={13} viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" />
              <polyline points="8,4.5 8,8 10.2,9.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            History ({history.length})
          </button>

          {showHistory && (
            <WorkflowHistoryPanel
              history={history}
              viewingId={viewingEntryId}
              onSelectRun={setViewingEntryId}
              onClose={() => setShowHistory(false)}
            />
          )}
        </div>
      )}

      {/* ── Main area ────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {/* Orchestrator state — shown before pipeline appears */}
        {showOrchestrator && (
          <div className="absolute inset-0 flex flex-col landing-dot-grid">
            {/* Centered orchestrator */}
            <div className="flex-1 flex items-center justify-center px-4">
              <div className="flex flex-col items-center gap-3 sm:gap-4">
                <div
                  className="size-16 sm:size-20 rounded-full flex items-center justify-center"
                  style={{
                    background: isWaitingForPlan ? "rgba(96, 165, 250, 0.12)" : "rgba(96, 165, 250, 0.08)",
                    border: `1.5px solid rgba(96, 165, 250, ${isWaitingForPlan ? "0.5" : "0.3"})`,
                    boxShadow: `0 0 30px rgba(96, 165, 250, ${isWaitingForPlan ? "0.25" : "0.15"})`,
                    animation: isWaitingForPlan ? "glow-pulse 2s ease-in-out infinite" : undefined,
                    // @ts-expect-error CSS custom property
                    "--glow-color": "rgba(96, 165, 250, 0.3)",
                  }}
                >
                  <AgentAvatar role="orchestrator" size={44} status={isWaitingForPlan ? "working" : "idle"} />
                </div>
                <div className="text-center">
                  <div className="text-[0.88rem] sm:text-[0.95rem] font-semibold text-[var(--text)]">Orchestrator</div>
                  <div className="text-[0.7rem] sm:text-[0.75rem] text-[var(--text-muted)] mt-1">
                    {isRestoring
                      ? "Restoring session..."
                      : isWaitingForPlan
                        ? "Planning the pipeline..."
                        : "Describe a task to start the pipeline"}
                  </div>
                </div>
              </div>
            </div>
            {/* Bottom input bar */}
            <div className="px-2 sm:px-4 pb-3 sm:pb-4 flex flex-col items-center gap-2">
              {history.length === 0 && !isWaitingForPlan && !followUpHasText && (
                <SuggestionChips onSelect={handleSuggestionSelect} />
              )}
              <div
                className="flex items-center gap-2.5 sm:gap-3.5 px-3.5 sm:px-5 py-2.5 border border-[var(--glass-border)] rounded-[16px] bg-[var(--topbar-bg)] backdrop-blur-[20px] [-webkit-backdrop-filter:blur(20px)] shadow-[0_4px_24px_rgba(0,0,0,0.15)] z-[90] w-full max-w-[780px]"
              >
                  <span className="text-[0.6rem] sm:text-[0.65rem] text-[var(--text-muted)] whitespace-nowrap shrink-0">
                  {isRestoring ? "Restoring..." : isWaitingForPlan ? "Working..." : "Ready"}
                </span>
                <div className="flex-1 min-w-0">
                  <ChatInput
                    onSubmit={handleSubmit}
                    disabled={isInputDisabled}
                    loading={isInputDisabled}
                    compact
                    textareaRef={followUpRef}
                    onTextChange={setFollowUpHasText}
                  />
                </div>
                <span className="text-[0.72rem] text-[var(--text-muted)] whitespace-nowrap shrink-0 opacity-60 hidden sm:inline">
                  {"\u2318"} Enter
                </span>
              </div>
            </div>
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

        {/* Bottom bar */}
        {hasPipeline && (
          <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 z-[90] flex flex-col items-center gap-2 w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-[780px]">
            <div
              className="flex items-center gap-2.5 sm:gap-3.5 px-3 sm:px-4 py-2 border border-[var(--glass-border)] rounded-[18px] bg-[var(--topbar-bg)] backdrop-blur-[20px] [-webkit-backdrop-filter:blur(20px)] shadow-[0_4px_24px_rgba(0,0,0,0.15)] w-full"
            >
              <span className="text-[0.75rem] sm:text-[0.8rem] text-[var(--text-muted)] whitespace-nowrap shrink-0 hidden sm:inline">
                {isLoading
                  ? `Working... (${latestEntry?.workingAgents.map((a) => a.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")).join(", ") || "planning"})`
                  : latestEntry?.done
                    ? "Pipeline complete"
                    : "Ready"}
              </span>
              <div className="flex-1 min-w-0">
                <ChatInput
                  onSubmit={handleSubmit}
                  disabled={isInputDisabled}
                  loading={isLoading}
                  compact
                  textareaRef={followUpRef}
                  onTextChange={setFollowUpHasText}
                />
              </div>
              <span className="text-[0.72rem] text-[var(--text-muted)] whitespace-nowrap shrink-0 opacity-60 hidden sm:inline">
                {"\u2318"} Enter
              </span>
            </div>
          </div>
        )}
      </div>

      {/* GitHub disconnected warning */}
      {githubWarning && (
        <div className="mx-5 mb-2 px-3.5 py-[0.65rem] rounded-[10px] bg-[rgba(234,179,8,0.08)] border border-[rgba(234,179,8,0.18)] flex items-start gap-[0.6rem] animate-slide-in">
          <div className="size-7 rounded-full bg-[rgba(234,179,8,0.12)] flex items-center justify-center shrink-0 mt-px">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 22h20L12 2z" stroke="#eab308" strokeWidth="1.8" fill="none" />
              <line x1="12" y1="10" x2="12" y2="15" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="18" r="1.2" fill="#eab308" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[0.78rem] font-semibold text-[#eab308] mb-0.5">GitHub disconnected</div>
            <div className="text-[0.72rem] text-[var(--text-muted)] leading-[1.4]">{githubWarning}</div>
          </div>
          <button
            className="p-[0.2rem] rounded border-none bg-transparent text-[var(--text-muted)] cursor-pointer flex items-center justify-center transition-colors duration-150 hover:text-[#eab308]"
            onClick={() => setGithubWarning(null)}
          >
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
              <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Error */}
      {latestEntry?.error && !dismissedErrors.has(latestEntry.id) && (
        <ErrorBanner
          message={latestEntry.error}
          onRetry={lastMessage ? () => handleSubmit(lastMessage) : undefined}
          onDismiss={() => setDismissedErrors((prev) => new Set(prev).add(latestEntry.id))}
        />
      )}

      {/* Detail panel */}
      {selectedOutput && selectedAgent && (
        <DetailPanel
          agent={selectedAgent}
          response={selectedOutput.response}
          tasks={selectedOutput.tasks ?? []}
          files={selectedOutput.files ?? []}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-16 sm:bottom-4 left-2 sm:left-4 flex flex-col-reverse gap-[0.4rem] z-[100] pointer-events-none">
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
