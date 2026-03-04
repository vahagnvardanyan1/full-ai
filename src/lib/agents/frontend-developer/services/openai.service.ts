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
import { buildRoleSkillContext } from "../../skills/skill-loader.service";
import type {
  LLMMessage,
  CodeGenerationRequest,
  CodeGenerationResponse,
  TaskPlan,
  IssueInfo,
  SelfReviewResult,
} from "../types";

const log = createChildLogger("openai-service");

// ── JSON Repair Utility ─────────────────────────────────
// Handles the most common truncation pattern: response cut mid-string,
// leaving unclosed quotes/braces. This recovers many cases where only
// the closing `"}` is missing.

function tryRepairJSON(raw: string): string {
  let repaired = raw.trim();

  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\") {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "{") braceCount++;
      else if (ch === "}") braceCount--;
      else if (ch === "[") bracketCount++;
      else if (ch === "]") bracketCount--;
    }
  }

  // Close unclosed string
  if (inString) repaired += '"';

  // Close unclosed arrays
  for (let i = 0; i < bracketCount; i++) repaired += "]";

  // Close unclosed objects
  for (let i = 0; i < braceCount; i++) repaired += "}";

  return repaired;
}

// ── Safe JSON Parser ────────────────────────────────────

function safeParseJSON<T>(raw: string, context: string): T {
  // First attempt: standard parse
  try {
    return JSON.parse(raw) as T;
  } catch (firstErr) {
    // Second attempt: repair then parse
    try {
      const repaired = tryRepairJSON(raw);
      const result = JSON.parse(repaired) as T;
      log.warn({ context }, "JSON parse succeeded after repair — response was likely truncated");
      return result;
    } catch {
      // Both failed — throw descriptive error
      const preview = raw.slice(0, 200);
      const originalMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      throw new Error(
        `JSON parse failed in ${context}: ${originalMsg}. ` +
        `Response preview: ${preview}...`,
      );
    }
  }
}

// ── Response type from internal chat ────────────────────

interface ChatRawResponse {
  content: string;
  finishReason: string;
  totalTokens: number;
}

export class OpenAIService {
  private model: string;
  private maxTokens: number;
  private skillContextPromise: Promise<string>;

  constructor(model = "gpt-4o", maxTokens = 4096) {
    this.model = model;
    this.maxTokens = maxTokens;
    this.skillContextPromise = buildRoleSkillContext("frontend_developer");
  }

  private async withSkills(basePrompt: string): Promise<string> {
    const skillContext = await this.skillContextPromise;
    if (!skillContext) return basePrompt;
    return `${basePrompt}\n\n${skillContext}`;
  }

  // ── Internal LLM Call (with truncation detection) ──────

  private async chatRaw(
    messages: LLMMessage[],
    opts: { maxTokens?: number; jsonMode?: boolean } = {},
  ): Promise<ChatRawResponse> {
    const maxTokens = opts.maxTokens ?? this.maxTokens;
    const jsonMode = opts.jsonMode ?? false;

    log.debug({ messageCount: messages.length, jsonMode, maxTokens }, "Sending LLM request");

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      temperature: 0.2,
      messages,
      ...(jsonMode && { response_format: { type: "json_object" as const } }),
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI");

    const finishReason = response.choices[0]?.finish_reason ?? "unknown";
    const totalTokens = response.usage?.total_tokens ?? 0;

    log.debug({ tokens: totalTokens, finishReason }, "LLM response received");

    if (finishReason === "length") {
      log.warn({ totalTokens, maxTokens }, "Response truncated — hit max_tokens limit");
    }

    return { content, finishReason, totalTokens };
  }

  // ── Public chat() — backward-compatible ────────────────
  // Used by index.ts for ad-hoc calls (task completion check etc.)

  async chat(messages: LLMMessage[], jsonMode = false): Promise<string> {
    const resp = await this.chatRaw(messages, { jsonMode });
    return resp.content;
  }

  // ── Task Planning ──────────────────────────────────────

  async planTask(issue: IssueInfo, repoContext: string): Promise<TaskPlan> {
    log.info({ issue: issue.number }, "Planning task for issue");
    const planningPrompt = await this.withSkills(PLANNING_PROMPT);

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: planningPrompt,
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

    const resp = await this.chatRaw(messages, { maxTokens: 4096, jsonMode: true });
    return safeParseJSON<TaskPlan>(resp.content, "planTask");
  }

  // ── Code Generation (with truncation retry) ────────────

  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse> {
    log.info({ task: request.task.slice(0, 80) }, "Generating code");
    const codePrompt = await this.withSkills(CODE_GENERATION_PROMPT);

    // ── Build the existing-code section with DIFF-AWARENESS ──
    let existingCodeSection = "";
    if (request.existingCode) {
      existingCodeSection = `## CURRENT FILE CONTENT (YOU MUST MODIFY THIS — NOT ECHO IT)
\`\`\`${request.language || ""}
${request.existingCode}
\`\`\`

⚠️ CRITICAL: The code above is what CURRENTLY exists. Your job is to CHANGE it according to the task.
- If you return code that is identical or near-identical to the above, you have FAILED.
- Before writing code, mentally identify the SPECIFIC lines/sections/components you will change.
- Your output must contain VISIBLE, MEANINGFUL differences from the current file.
- "Preserve working parts" means keep unrelated logic intact — it does NOT mean return the same file unchanged.`;
    }

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: codePrompt,
      },
      {
        role: "user",
        content: `## Task
${request.task}

## Context
${request.context}

${existingCodeSection}

${request.constraints?.length ? `## Constraints\n${request.constraints.map((c) => `- ${c}`).join("\n")}` : ""}

${request.existingCode ? `BEFORE generating code, briefly state (in the "explanation" field) WHAT SPECIFICALLY you are changing and WHY it differs from the current file. Then generate the COMPLETE modified file.` : "Generate the code. Make sure ALL imports are correct and ALL existing functionality is preserved."}`,
      },
    ];

    // Estimate a reasonable token budget based on existing code size.
    // Existing code in tokens ≈ chars / 3.5 (rough estimate for code).
    // We need enough for the full file + JSON wrapper + explanation.
    const existingTokenEstimate = request.existingCode
      ? Math.ceil(request.existingCode.length / 3.5)
      : 0;
    // Base budget: enough for a new file. Scale up if modifying a large file.
    const baseBudget = 4096;
    const codeTokenBudget = Math.max(baseBudget, existingTokenEstimate + 1024);
    // Cap at a reasonable maximum
    const initialMaxTokens = Math.min(codeTokenBudget, 16384);

    log.debug({ existingTokenEstimate, initialMaxTokens }, "Code generation token budget");

    // First attempt
    let resp = await this.chatRaw(messages, { maxTokens: initialMaxTokens, jsonMode: true });

    // If truncated, retry with doubled budget (capped at 32768)
    if (resp.finishReason === "length") {
      const retryMaxTokens = Math.min(initialMaxTokens * 2, 32768);
      log.warn(
        { initialMaxTokens, retryMaxTokens },
        "Code generation truncated — retrying with higher token limit",
      );
      resp = await this.chatRaw(messages, { maxTokens: retryMaxTokens, jsonMode: true });

      if (resp.finishReason === "length") {
        log.error("Code generation still truncated after retry — will attempt JSON repair");
      }
    }

    return safeParseJSON<CodeGenerationResponse>(resp.content, "generateCode");
  }

  // ── Self-Review ────────────────────────────────────────

  async selfReviewCode(
    files: { filename: string; code: string; language: string }[],
    taskDescription: string,
    repoContext: string,
  ): Promise<SelfReviewResult> {
    log.info({ fileCount: files.length }, "Self-reviewing generated code");
    const reviewPrompt = await this.withSkills(SELF_REVIEW_PROMPT);

    const fileContents = files
      .map((f) => `### ${f.filename} (${f.language})\n\`\`\`${f.language}\n${f.code}\n\`\`\``)
      .join("\n\n");

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: reviewPrompt,
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

    const resp = await this.chatRaw(messages, { maxTokens: 4096, jsonMode: true });
    return safeParseJSON(resp.content, "selfReviewCode");
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
    const commitPrompt = await this.withSkills(COMMIT_TITLE_PROMPT);

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
        content: commitPrompt,
      },
      {
        role: "user",
        content: `## ORIGINAL USER TASK (this is what the commit title must describe)\n${taskDescription}\n\n## Files Changed\n${cleanedFiles.map((f) => `- ${f.filename}: ${f.explanation}`).join("\n")}\n\nGenerate the commit title based on the ORIGINAL USER TASK above, NOT based on any internal fix steps.`,
      },
    ];

    const resp = await this.chatRaw(messages, { maxTokens: 1024, jsonMode: true });
    return safeParseJSON(resp.content, "generateCommitTitle");
  }
}
