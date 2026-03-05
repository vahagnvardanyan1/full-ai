"use client";

// ──────────────────────────────────────────────────────────
// useWorkspaceSession
//
// Persists a stable sessionId in localStorage (keyed by
// teamId) so the same server-side conversation session is
// resumed on page reload.
//
// On mount it calls GET /api/workflows?sessionId=<id> to
// fetch prior workflow runs from MongoDB and returns the
// reconstructed history + task list for the workspace page
// to restore its UI state.
//
// If the most recent run was still "running" when the page
// was last closed, activeRunRequestId is set so the caller
// can start polling for live updates.
// ──────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";

import { replayWorkflowRuns } from "@/lib/workflow-replay";
import type { HistoryEntry, StoredWorkflowRun } from "@/lib/workflow-replay";
import type { TaskItem } from "@/lib/agents/types";

interface UseWorkspaceSessionResult {
  /** Stable session ID — null only during the initial localStorage read */
  sessionId: string | null;
  /** True while fetching prior runs from the backend */
  isRestoring: boolean;
  /** Reconstructed history from stored runs (empty if none) */
  restoredHistory: HistoryEntry[];
  /** Deduplicated tasks from all prior runs (empty if none) */
  restoredTasks: TaskItem[];
  /**
   * requestId of the most recent run that was still "running" on the server
   * when this session was loaded. Non-null triggers live polling.
   */
  activeRunRequestId: string | null;
  /** Clears current session and starts a fresh one. */
  resetSession: () => void;
}

const buildStorageKey = (teamId: string) => `workspace-session-${teamId}`;

const fetchWorkflowRuns = async (sessionId: string): Promise<StoredWorkflowRun[]> => {
  const res = await fetch(`/api/workflows?sessionId=${encodeURIComponent(sessionId)}&limit=10`);
  if (!res.ok) return [];
  const data = (await res.json()) as { runs?: StoredWorkflowRun[] };
  return data.runs ?? [];
};

/** A run is still active on the server if it's "running" and the server
 *  was still writing events recently (updatedAt within 10 minutes). */
const isActiveRun = (run: StoredWorkflowRun): boolean =>
  run.status === "running" &&
  Date.now() - new Date(run.updatedAt).getTime() < 10 * 60 * 1000;

export const useWorkspaceSession = ({ teamId }: { teamId: string }): UseWorkspaceSessionResult => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [restoredHistory, setRestoredHistory] = useState<HistoryEntry[]>([]);
  const [restoredTasks, setRestoredTasks] = useState<TaskItem[]>([]);
  const [activeRunRequestId, setActiveRunRequestId] = useState<string | null>(null);

  useEffect(() => {
    const storageKey = buildStorageKey(teamId);

    let sid = localStorage.getItem(storageKey);
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(storageKey, sid);
    }
    setSessionId(sid);

    fetchWorkflowRuns(sid)
      .then((runs) => {
        if (runs.length > 0) {
          const { history, allTasks } = replayWorkflowRuns(runs);
          setRestoredHistory(history);
          setRestoredTasks(allTasks);

          // Most recent run is index 0 (API returns newest-first)
          const latestRun = runs[0];
          if (latestRun && isActiveRun(latestRun)) {
            setActiveRunRequestId(latestRun.requestId);
          }
        }
      })
      .catch(() => undefined)
      .finally(() => setIsRestoring(false));
  }, [teamId]);

  const resetSession = useCallback(() => {
    const newId = crypto.randomUUID();
    localStorage.setItem(buildStorageKey(teamId), newId);
    setSessionId(newId);
    setRestoredHistory([]);
    setRestoredTasks([]);
    setActiveRunRequestId(null);
    setIsRestoring(false);
  }, [teamId]);

  return {
    sessionId,
    isRestoring,
    restoredHistory,
    restoredTasks,
    activeRunRequestId,
    resetSession,
  };
};
