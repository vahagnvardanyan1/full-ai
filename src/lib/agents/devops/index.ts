import { DevOpsOpenAIService } from "./services/openai.service";
import type { AgentResponse } from "../types";

export const runDevOpsAgent = async (
  userMessage: string,
): Promise<AgentResponse> => {
  const openaiService = new DevOpsOpenAIService();
  return openaiService.run({ userMessage });
};
