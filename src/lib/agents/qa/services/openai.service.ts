import { getOpenAIClient } from "@/lib/clients/openai";
import { QA_TOOLS } from "@/lib/tools/definitions";

import { buildRoleSkillContext } from "../../skills/skill-loader.service";
import { runAgent } from "../../runner";
import type { AgentResponse } from "../../types";
import { QA_SYSTEM_PROMPT } from "../system-prompt";
import type { QAAutomationDecision, QARunInput } from "../types";

const QA_STRATEGY_PROMPT = `You are a principal QA strategist.
Analyze the request and decide whether automation tests should be created in this run.

Rules:
- Use strict JSON output only.
- Prefer automation when behavior can regress and assertions are deterministic.
- If automation is not recommended, provide a concrete manual checklist.
- No mock data policy: avoid mock/stub-based testing strategy.

Return JSON:
{
  "shouldAutomate": true,
  "rationale": "string",
  "candidateAreas": ["array of affected areas/files/features"],
  "manualChecklist": ["array of manual checks"],
  "regressionRisks": ["array of what could break"]
}`;

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class QAOpenAIService {
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly skillContextPromise: Promise<string>;

  constructor(model = "gpt-4o", maxTokens = 4096) {
    this.model = model;
    this.maxTokens = maxTokens;
    this.skillContextPromise = buildRoleSkillContext("qa");
  }

  private withSkills = async (basePrompt: string): Promise<string> => {
    const skillContext = await this.skillContextPromise;
    if (!skillContext) return basePrompt;
    return `${basePrompt}\n\n${skillContext}`;
  };

  private chat = async ({
    messages,
    jsonMode = false,
  }: {
    messages: LLMMessage[];
    jsonMode?: boolean;
  }): Promise<string> => {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: 0.2,
      messages,
      ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("QA OpenAI service returned empty content");
    }
    return content;
  };

  decideAutomationStrategy = async ({
    userMessage,
    validationSummary,
  }: {
    userMessage: string;
    validationSummary: string;
  }): Promise<QAAutomationDecision> => {
    const systemPrompt = await this.withSkills(QA_STRATEGY_PROMPT);
    const content = await this.chat({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Request:\n${userMessage}\n\nCurrent validation signals:\n${validationSummary}`,
        },
      ],
      jsonMode: true,
    });

    const parsed = JSON.parse(content) as QAAutomationDecision;
    return {
      shouldAutomate: Boolean(parsed.shouldAutomate),
      rationale: parsed.rationale || "Strategy rationale unavailable.",
      candidateAreas: parsed.candidateAreas || [],
      manualChecklist: parsed.manualChecklist || [],
      regressionRisks: parsed.regressionRisks || [],
    };
  };

  run = async ({ userMessage }: QARunInput): Promise<AgentResponse> => {
    const systemPrompt = await this.withSkills(QA_SYSTEM_PROMPT);
    return runAgent({
      role: "qa",
      systemPrompt,
      userMessage,
      tools: QA_TOOLS,
    });
  };
}
