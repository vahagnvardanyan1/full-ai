import { connectDB } from "@/lib/db/connection";
import { AgentRunModel } from "@/lib/db/models/agent-run";
import type { IAgentRunDocument, AgentRunStatus } from "@/lib/db/models/agent-run";

export interface SaveAgentRunParams {
  agentType: string;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  errorCode?: number;
}

export interface ListAgentRunsParams {
  agentType?: string;
  limit?: number;
}

export const saveAgentRun = async ({
  agentType,
  status,
  input,
  errorCode,
}: SaveAgentRunParams): Promise<void> => {
  await connectDB();
  await AgentRunModel.create({
    runId: crypto.randomUUID(),
    agentType,
    status,
    input,
    errorCode,
  });
};

export const listAgentRuns = async ({
  agentType,
  limit = 20,
}: ListAgentRunsParams): Promise<IAgentRunDocument[]> => {
  await connectDB();
  const filter = agentType ? { agentType } : {};
  return AgentRunModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<IAgentRunDocument[]>()
    .exec();
};
