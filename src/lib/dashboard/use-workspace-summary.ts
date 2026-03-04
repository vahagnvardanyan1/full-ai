"use client";

import { useState, useEffect } from "react";

export interface ActivityItem {
  agent: string;
  action: string;
  runPrompt: string;
  prUrl: string | null;
  runCreatedAt: string;
}

export interface PipelineRunItem {
  requestId: string;
  prompt: string;
  taskCount: number;
  agentCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSummaryData {
  recentActivity: ActivityItem[];
  pipelineRuns: PipelineRunItem[];
  stats: {
    totalTasks: number;
    totalRuns: number;
    uptimePercent: number | null;
  };
}

interface UseWorkspaceSummaryResult {
  data: WorkspaceSummaryData | null;
  loading: boolean;
  error: string | null;
}

export const useWorkspaceSummary = (): UseWorkspaceSummaryResult => {
  const [data, setData] = useState<WorkspaceSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch("/api/workspace/summary");
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = (await res.json()) as WorkspaceSummaryData;
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workspace data");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  return { data, loading, error };
};
