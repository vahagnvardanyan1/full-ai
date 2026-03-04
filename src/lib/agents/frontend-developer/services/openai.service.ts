// ──────────────────────────────────────────────────────────
// OpenAI Service — from ai-engineer-agent-v3
// Adapted to use full-ai's getOpenAIClient()
// ──────────────────────────────────────────────────────────

import { getOpenAIClient } from "@/lib/clients/openai";
import { createChildLogger } from "../utils/logger";
import {
  PLANNING_PROMPT,
  CODE_GENERATION_PROMPT,
  SELF_REVIEW_PROMPT,
  COMMIT_TITLE_PROMPT,
} from "../system-prompt";
import type {
  LLMMessage,
  CodeGenerationRequest,
  CodeGenerationResponse,
  TaskPlan,
  IssueInfo,
} from "../types";

const log = createChildLogger("openai-service");

export class OpenAIService {
  private model: string;
  private maxTokens: number;

  constructor(model = "gpt-4o", maxTokens = 4096) {
    this.model = model;
    this.maxTokens = maxTokens;
  }

  // ── Core LLM Call ──────────────────────────────────────

  async chat(messages: LLMMessage[], jsonMode = false): Promise<string> {
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

  // ── Task Planning ──────────────────────────────────────

  async planTask(issue: IssueInfo, repoContext: string): Promise<TaskPlan> {
    log.info({ issue: issue.number }, "Planning task for issue");

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: PLANNING_PROMPT,
      },
      {
        role: "user",
        content: `## Repository Context
${repoContext}

## Issue #${issue.number}: ${issue.title}
${issue.body}

Labels: ${issue.labels.join(", ") || "none"}

Create a detailed implementation plan. Make sure file paths match the existing repo structure.`,
      },
    ];

    const response = await this.chat(messages, true);
    return JSON.parse(response) as TaskPlan;
  }

  // ── Code Generation ────────────────────────────────────

  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse> {
    log.info({ task: request.task.slice(0, 80) }, "Generating code");

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: CODE_GENERATION_PROMPT,
      },
      {
        role: "user",
        content: `## Task
${request.task}

## Context
${request.context}

${request.existingCode ? `## Existing Code (PRESERVE working parts)\n\`\`\`${request.language || ""}\n${request.existingCode}\n\`\`\`` : ""}

${request.constraints?.length ? `## Constraints\n${request.constraints.map((c) => `- ${c}`).join("\n")}` : ""}

Generate the code. Make sure ALL imports are correct and ALL existing functionality is preserved.`,
      },
    ];

    const response = await this.chat(messages, true);
    return JSON.parse(response) as CodeGenerationResponse;
  }

  // ── Self-Review ────────────────────────────────────────

  async selfReviewCode(
    files: { filename: string; code: string; language: string }[],
    taskDescription: string,
    repoContext: string,
  ): Promise<{
    approved: boolean;
    issues: { filename: string; issue: string; fix: string; severity: string }[];
    summary: string;
  }> {
    log.info({ fileCount: files.length }, "Self-reviewing generated code");

    const fileContents = files
      .map((f) => `### ${f.filename} (${f.language})\n\`\`\`${f.language}\n${f.code}\n\`\`\``)
      .join("\n\n");

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: SELF_REVIEW_PROMPT,
      },
      {
        role: "user",
        content: `## Task
${taskDescription}

## Repository Context
${repoContext.slice(0, 4000)}

## Generated Code to Review
${fileContents}

Review EVERY file strictly. Focus especially on:
1. Are ALL imports correct? (missing imports = instant build failure)
2. Does the code actually fulfill the task requirements?
3. Would this pass TypeScript compilation and ESLint?
4. Are there any security issues?`,
      },
    ];

    const response = await this.chat(messages, true);
    return JSON.parse(response);
  }

  // ── Fix Code Issues ────────────────────────────────────

  async fixCodeIssues(
    original: { filename: string; code: string; language: string },
    issues: { issue: string; fix: string }[],
    repoContext: string,
  ): Promise<CodeGenerationResponse> {
    log.info({ filename: original.filename, issueCount: issues.length }, "Fixing code issues");

    const issueList = issues.map((i, idx) => `${idx + 1}. ${i.issue}\n   Fix: ${i.fix}`).join("\n");

    return this.generateCode({
      task: `Fix the following issues in this file:\n${issueList}`,
      context: repoContext.slice(0, 6000),
      existingCode: original.code,
      language: original.language,
      constraints: [
        `Target file: ${original.filename}`,
        "Action: modify",
        "CRITICAL: Fix ALL listed issues while preserving EVERY line of working code",
        "Do NOT remove or change any import, type annotation, className, prop, or function that is not mentioned in the errors",
        "Do NOT reformat the file — only change the specific lines with errors",
        "Do NOT introduce new issues — the fix must be surgical",
        "If an error mentions a specific line number, fix ONLY that line",
        "If an error mentions a specific ESLint rule, fix the code to comply with that rule",
      ],
    });
  }

  // ── Smart Commit/PR Title ──────────────────────────────

  async generateCommitTitle(
    taskDescription: string,
    changedFiles: { filename: string; explanation: string }[],
  ): Promise<{ title: string; type: string; scope: string }> {
    log.info("Generating smart commit title");

    // Strip internal fix noise from explanations so the LLM focuses on the actual task
    const cleanedFiles = changedFiles.map((f) => ({
      filename: f.filename,
      explanation: f.explanation
        .replace(/^\[fixed\]\s*/i, "")
        .replace(/fix(?:ed)?\s+prettier\s+(?:issues?|errors?|warnings?)/gi, "")
        .replace(/fix(?:ed)?\s+(?:eslint|lint)\s+(?:issues?|errors?|warnings?)/gi, "")
        .replace(/reformatted?\s+code/gi, "")
        .trim() || f.explanation,
    }));

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: COMMIT_TITLE_PROMPT,
      },
      {
        role: "user",
        content: `## ORIGINAL USER TASK (this is what the commit title must describe)\n${taskDescription}\n\n## Files Changed\n${cleanedFiles.map((f) => `- ${f.filename}: ${f.explanation}`).join("\n")}\n\nGenerate the commit title based on the ORIGINAL USER TASK above, NOT based on any internal fix steps.`,
      },
    ];

    const response = await this.chat(messages, true);
    return JSON.parse(response);
  }
}
