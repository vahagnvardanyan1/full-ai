"use client";

// ──────────────────────────────────────────────────────────
// useRunPolling
//
// When the user reloads mid-run the SSE connection is lost,
// but the server pipeline keeps executing and writing events
// to MongoDB. This hook re-attaches by polling
// GET /api/workflows?id=<requestId> every few seconds,
// replaying the growing events array, and pushing state
// updates to the caller until the run finishes.
//
// Stale detection: if the event count hasn't grown for
// MAX_STALE_POLLS consecutive polls, the run is considered
// dead and polling stops.
// ──────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from "react";

import { replayWorkflowRuns } from "@/lib/workflow-replay";
import type { StoredWorkflowRun, HistoryEntry } from "@/lib/workflow-replay";
import type { TaskItem } from "@/lib/agents/types";

const POLL_INTERVAL_MS = 3_000;
const MAX_STALE_POLLS = 6; // ~18 s of silence → give up

interface UseRunPollingOptions {
  requestId: string | null;
  onUpdate: ({ entry, tasks }: { entry: HistoryEntry; tasks: TaskItem[] }) => void;
  onDone: () => void;
}

const fetchRun = async (requestId: string): Promise<StoredWorkflowRun | null> => {
  try {
    const res = await fetch(`/api/workflows?id=${encodeURIComponent(requestId)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { run?: StoredWorkflowRun };
    return data.run ?? null;
  } catch {
    return null;
  }
};

export const useRunPolling = ({ requestId, onUpdate, onDone }: UseRunPollingOptions): void => {
  const lastEventCountRef = useRef(0);
  const staleCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const onDoneRef = useRef(onDone);

  // Keep refs up to date so the interval closure never goes stale
  onUpdateRef.current = onUpdate;
  onDoneRef.current = onDone;

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!requestId) return;

    // Reset counters whenever the requestId changes
    lastEventCountRef.current = 0;
    staleCountRef.current = 0;

    const poll = async () => {
      const run = await fetchRun(requestId);
      if (!run) return;

      const currentEventCount = run.events.length;

      if (currentEventCount === lastEventCountRef.current) {
        staleCountRef.current += 1;
        if (staleCountRef.current >= MAX_STALE_POLLS) {
          stopPolling();
          onDoneRef.current();
          return;
        }
      } else {
        staleCountRef.current = 0;
        lastEventCountRef.current = currentEventCount;
      }

      const { history, allTasks } = replayWorkflowRuns([run]);
      if (history[0]) {
        onUpdateRef.current({ entry: history[0], tasks: allTasks });
      }

      if (run.status !== "running") {
        stopPolling();
        onDoneRef.current();
      }
    };

    // Fire immediately, then on the interval
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return stopPolling;
  }, [requestId, stopPolling]);
};
