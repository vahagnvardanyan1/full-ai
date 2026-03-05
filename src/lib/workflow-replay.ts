// ──────────────────────────────────────────────────────────
// Workflow replay — converts stored WorkflowRun documents
// from the GET /api/workflows response back into the
// HistoryEntry shape used by the workspace UI.
//
// We replay the events[] array (the same SSE stream that
// was fed to the UI originally) so partial/interrupted runs
// are also restored correctly — including which agents were
// in-progress when the pipeline was cut off.
// ──────────────────────────────────────────────────────────

import type { AgentRole, AgentResponse, TaskItem, GeneratedFile, StreamEvent } from "@/lib/agents/types";

// ── Shared UI types ───────────────────────────────────────

export interface AgentOutput {
  response: AgentResponse;
  tasks: TaskItem[];
  files: GeneratedFile[];
}

export interface HistoryEntry {
  id: string;
  userMessage: string;
  plan: string | null;
  phases: AgentRole[][] | null;
  workingAgents: string[];
  outputs: AgentOutput[];
  error: string | null;
  done: boolean;
}

// ── Shape of a run returned by GET /api/workflows ─────────

export interface StoredWorkflowRun {
  requestId: string;
  sessionId: string;
  userMessage: string;
  planSummary: string;
  phases: AgentRole[][];
  status: "running" | "completed" | "failed";
  events: StreamEvent[];
  tasks: Array<TaskItem & { createdBy: string }>;
  files: Array<GeneratedFile & { createdBy: string }>;
  agentResults: AgentResponse[];
  createdAt: string;
  updatedAt: string;
}

// ── How long before a "running" run is considered orphaned ─
const ORPHAN_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

const isOrphaned = (run: StoredWorkflowRun): boolean =>
  run.status === "running" &&
  Date.now() - new Date(run.updatedAt).getTime() > ORPHAN_THRESHOLD_MS;

// ── Event-driven state reconstruction ────────────────────

interface ReplayedState {
  plan: string | null;
  phases: AgentRole[][] | null;
  workingAgents: string[];
  outputs: AgentOutput[];
  allRunTasks: TaskItem[];
  error: string | null;
  done: boolean;
}

const replayEvents = (run: StoredWorkflowRun): ReplayedState => {
  const state: ReplayedState = {
    plan: run.planSummary || null,
    phases: run.phases?.length ? run.phases : null,
    workingAgents: [],
    outputs: [],
    allRunTasks: [],
    error: null,
    done: false,
  };

  const taskMap = new Map<string, TaskItem>();

  for (const event of run.events) {
    switch (event.type) {
      case "plan":
        state.plan = event.plan;
        state.phases = event.phases;
        break;

      case "agent_start":
        if (!state.workingAgents.includes(event.agent)) {
          state.workingAgents.push(event.agent);
        }
        break;

      case "agent_complete": {
        // Move agent from working → done
        state.workingAgents = state.workingAgents.filter((a) => a !== event.response.agent);
        state.outputs.push({
          response: event.response,
          tasks: event.tasks,
          files: event.files,
        });
        for (const t of event.tasks) taskMap.set(t.id, t);
        break;
      }

      case "tasks_updated":
        for (const t of event.tasks) taskMap.set(t.id, t);
        break;

      case "error":
        state.error = event.message;
        break;

      case "done":
        state.done = true;
        state.workingAgents = [];
        break;
    }
  }

  // For completed runs, the run-level task snapshot has the final correct
  // statuses. For running runs, the events (especially tasks_updated) may
  // have newer statuses than the run-level snapshot, so only use run.tasks
  // to fill in tasks not yet seen in events.
  if (run.status === "completed") {
    // Completed: run-level snapshot is authoritative (written at end)
    for (const t of run.tasks) taskMap.set(t.id, t as TaskItem);
  } else {
    // Running/failed: only add tasks from run.tasks that weren't in events
    for (const t of run.tasks) {
      if (!taskMap.has(t.id)) taskMap.set(t.id, t as TaskItem);
    }
  }
  state.allRunTasks = Array.from(taskMap.values());

  return state;
};

// ── Per-run conversion ────────────────────────────────────

const runToHistoryEntry = (run: StoredWorkflowRun): HistoryEntry => {
  const state = replayEvents(run);
  const orphaned = isOrphaned(run);

  return {
    id: run.requestId,
    userMessage: run.userMessage,
    plan: state.plan,
    phases: state.phases,
    // Orphaned runs are no longer actively working — clear the spinner
    workingAgents: orphaned ? [] : state.workingAgents,
    outputs: state.outputs,
    error:
      state.error ??
      (orphaned && state.outputs.length === 0
        ? "Pipeline was interrupted before any agent completed."
        : orphaned && state.workingAgents.length > 0
          ? `Pipeline was interrupted. Agents in progress: ${state.workingAgents.join(", ")}.`
          : null),
    done: state.done || orphaned,
  };
};

// ── Public API ────────────────────────────────────────────

/**
 * Convert an array of stored WorkflowRun documents (newest-first from API)
 * into the two pieces of state the workspace page needs:
 *   - `history`  — one HistoryEntry per run, oldest-first for display
 *   - `allTasks` — deduplicated tasks from all runs (latest status wins)
 */
export const replayWorkflowRuns = (
  runs: StoredWorkflowRun[],
): { history: HistoryEntry[]; allTasks: TaskItem[] } => {
  // API returns newest-first; reverse so oldest displays at the top
  const history = [...runs].reverse().map(runToHistoryEntry);

  // Build a unified task map: later runs overwrite earlier ones for same ID
  const taskMap = new Map<string, TaskItem>();
  for (const run of [...runs].reverse()) {
    const { allRunTasks } = replayEvents(run);
    for (const t of allRunTasks) taskMap.set(t.id, t);
  }

  return { history, allTasks: Array.from(taskMap.values()) };
};
