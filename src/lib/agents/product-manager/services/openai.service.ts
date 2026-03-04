// ──────────────────────────────────────────────────────────
// PM OpenAI Service — LLM calls for the PM pipeline.
// Each method corresponds to one pipeline stage.
// ──────────────────────────────────────────────────────────

import { getOpenAIClient } from "@/lib/clients/openai";
import { createChildLogger } from "../utils/logger";
import {
  REQUIREMENTS_PROMPT,
  FEASIBILITY_PROMPT,
  TASK_PLANNING_PROMPT,
  STORY_WRITING_PROMPT,
  RISK_ASSESSMENT_PROMPT,
} from "../system-prompt";
import type {
  PRDDocument,
  FeasibilityReport,
  PMTaskPlan,
  UserStory,
  RiskItem,
} from "../types";

const log = createChildLogger("openai");

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class PMOpenAIService {
  private model: string;
  private maxTokens: number;

  constructor(model = "gpt-4o", maxTokens = 4096) {
    this.model = model;
    this.maxTokens = maxTokens;
  }

  // ── Core LLM Call ──

  private async chat(messages: LLMMessage[], jsonMode = false): Promise<string> {
    log.debug({ messageCount: messages.length, jsonMode }, "Sending LLM request");

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: 0.2,
      messages,
      ...(jsonMode && { response_format: { type: "json_object" as const } }),
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI");

    log.debug({ tokens: response.usage?.total_tokens }, "LLM response received");
    return content;
  }

  // ── Stage 1: Requirements Analysis ──

  async analyzeRequirements(
    userRequest: string,
    repoContext: string,
  ): Promise<PRDDocument> {
    log.info("Analyzing requirements");

    const messages: LLMMessage[] = [
      { role: "system", content: REQUIREMENTS_PROMPT },
      {
        role: "user",
        content: `## Repository Context\n${repoContext}\n\n## User Request\n${userRequest}\n\nAnalyze this request and produce a structured requirements document. Reference real file paths from the repo.`,
      },
    ];

    const response = await this.chat(messages, true);
    return JSON.parse(response) as PRDDocument;
  }

  // ── Stage 2: Feasibility Assessment ──

  async assessFeasibility(
    prd: PRDDocument,
    repoContext: string,
  ): Promise<FeasibilityReport> {
    log.info("Assessing technical feasibility");

    const messages: LLMMessage[] = [
      { role: "system", content: FEASIBILITY_PROMPT },
      {
        role: "user",
        content: `## Repository Context\n${repoContext}\n\n## Requirements\nSummary: ${prd.summary}\nScope: ${prd.scope}\nOut of scope: ${prd.outOfScope}\nAcceptance Criteria:\n${prd.acceptanceCriteria.map((ac) => `- [${ac.priority}] ${ac.description}`).join("\n")}\n\nAssess the technical feasibility of implementing these requirements.`,
      },
    ];

    const response = await this.chat(messages, true);
    return JSON.parse(response) as FeasibilityReport;
  }

  // ── Stage 3: Task Planning ──

  async planTasks(
    prd: PRDDocument,
    feasibility: FeasibilityReport,
    repoContext: string,
  ): Promise<PMTaskPlan[]> {
    log.info("Planning tasks");

    const messages: LLMMessage[] = [
      { role: "system", content: TASK_PLANNING_PROMPT },
      {
        role: "user",
        content: `## Repository Context\n${repoContext}\n\n## Requirements\nSummary: ${prd.summary}\nGoals: ${prd.goals.join(", ")}\nScope: ${prd.scope}\nOut of scope: ${prd.outOfScope}\n\n## Feasibility\nComplexity: ${feasibility.complexity}/5\nEstimate: ${feasibility.estimatedHours}h\nRisks: ${feasibility.risks.join("; ")}\nAffected files: ${feasibility.affectedFiles.join(", ")}\nRecommendation: ${feasibility.recommendation}\n\n## Acceptance Criteria\n${prd.acceptanceCriteria.map((ac) => `- [${ac.id}][${ac.priority}] ${ac.description}`).join("\n")}\n\nDecompose into assignable tasks for the team. Reference real file paths.`,
      },
    ];

    const response = await this.chat(messages, true);
    const parsed = JSON.parse(response) as { tasks: PMTaskPlan[] };
    return parsed.tasks || [];
  }

  // ── Stage 4: Story Writing ──

  async writeStories(
    tasks: PMTaskPlan[],
    prd: PRDDocument,
  ): Promise<UserStory[]> {
    log.info("Writing user stories");

    const messages: LLMMessage[] = [
      { role: "system", content: STORY_WRITING_PROMPT },
      {
        role: "user",
        content: `## Requirements Summary\n${prd.summary}\nGoals: ${prd.goals.join(", ")}\nUser Personas: ${prd.userPersonas.join(", ")}\n\n## Tasks to write stories for:\n${tasks.filter((t) => t.type === "story" || t.type === "task").map((t) => `- ${t.title}: ${t.description.slice(0, 200)}`).join("\n")}\n\nWrite full user stories for these tasks.`,
      },
    ];

    const response = await this.chat(messages, true);
    const parsed = JSON.parse(response) as { stories: UserStory[] };
    return parsed.stories || [];
  }

  // ── Stage 5: Risk Assessment ──

  async assessRisks(
    prd: PRDDocument,
    feasibility: FeasibilityReport,
    tasks: PMTaskPlan[],
    repoContext: string,
  ): Promise<RiskItem[]> {
    log.info("Assessing risks");

    const messages: LLMMessage[] = [
      { role: "system", content: RISK_ASSESSMENT_PROMPT },
      {
        role: "user",
        content: `## Repository Context\n${repoContext.slice(0, 3000)}\n\n## Requirements\n${prd.summary}\nScope: ${prd.scope}\n\n## Feasibility\nComplexity: ${feasibility.complexity}/5\nTechnical risks: ${feasibility.risks.join("; ")}\nConstraints: ${feasibility.technicalConstraints.join("; ")}\n\n## Planned Tasks (${tasks.length}):\n${tasks.map((t) => `- [${t.priority}] ${t.title} (assigned to: ${t.assignedTo})`).join("\n")}\n\nIdentify all risks for this implementation.`,
      },
    ];

    const response = await this.chat(messages, true);
    const parsed = JSON.parse(response) as { risks: RiskItem[] };
    return parsed.risks || [];
  }
}
