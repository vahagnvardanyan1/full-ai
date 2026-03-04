import { DEVOPS_TOOLS } from "@/lib/tools/definitions";

import { runAgent } from "../../runner";
import type { AgentResponse } from "../../types";
import { DEVOPS_SYSTEM_PROMPT } from "../system-prompt";
import type { DevOpsRunInput } from "../types";

export class DevOpsOpenAIService {
  run = async ({ userMessage }: DevOpsRunInput): Promise<AgentResponse> => {
    return runAgent({
      role: "devops",
      systemPrompt: DEVOPS_SYSTEM_PROMPT,
      userMessage,
      tools: DEVOPS_TOOLS,
    });
  };
}
