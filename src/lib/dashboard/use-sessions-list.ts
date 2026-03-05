"use client";

import { useState, useEffect } from "react";

export interface SessionItem {
  sessionId: string;
  runCount: number;
  lastPrompt: string;
  status: "completed" | "failed" | "running";
  lastActivity: string;
}

interface RunPayload {
  sessionId: string;
  userMessage: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface UseSessionsListResult {
  sessions: SessionItem[];
  loading: boolean;
  currentSessionId: string | null;
}

const buildStorageKey = (teamId: string) => `workspace-session-${teamId}`;

export const readCurrentSessionId = (teamId: string): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(buildStorageKey(teamId));
};

export const writeCurrentSessionId = (teamId: string, sessionId: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(buildStorageKey(teamId), sessionId);
};

export const useSessionsList = ({ teamId }: { teamId: string }): UseSessionsListResult => {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentSessionId(readCurrentSessionId(teamId));
  }, [teamId]);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch("/api/workflows?limit=50");
        if (!res.ok) return;
        const data = (await res.json()) as { runs?: RunPayload[] };
        const runs = data.runs ?? [];

        // Runs are newest-first — first encounter per sessionId is the latest run
        const map = new Map<string, SessionItem>();
        for (const run of runs) {
          const existing = map.get(run.sessionId);
          if (!existing) {
            map.set(run.sessionId, {
              sessionId: run.sessionId,
              runCount: 1,
              lastPrompt: run.userMessage,
              status: run.status as SessionItem["status"],
              lastActivity: run.updatedAt ?? run.createdAt,
            });
          } else {
            existing.runCount++;
          }
        }

        setSessions(Array.from(map.values()));
      } catch {
        // non-critical — silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  return { sessions, loading, currentSessionId };
};
