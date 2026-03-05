"use client";

import { useState, useEffect, useCallback } from "react";

import type { IAgentRunDocument } from "@/lib/db/models/agent-run";

interface UseAgentHistoryParams {
  agentType?: string;
}

interface UseAgentHistoryResult {
  runs: IAgentRunDocument[];
  isLoading: boolean;
  refresh: () => void;
}

const fetchAgentRuns = async ({
  agentType,
}: {
  agentType?: string;
}): Promise<IAgentRunDocument[]> => {
  const params = new URLSearchParams({ limit: "20" });
  if (agentType) params.set("agentType", agentType);
  const res = await fetch(`/api/agents/history?${params.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { runs?: IAgentRunDocument[] };
  return data.runs ?? [];
};

export const useAgentHistory = ({
  agentType,
}: UseAgentHistoryParams): UseAgentHistoryResult => {
  const [runs, setRuns] = useState<IAgentRunDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchAgentRuns({ agentType })
      .then(setRuns)
      .catch(() => setRuns([]))
      .finally(() => setIsLoading(false));
  }, [agentType]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { runs, isLoading, refresh };
};
