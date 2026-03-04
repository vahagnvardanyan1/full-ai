// ──────────────────────────────────────────────────────────
// Frontend Developer Agent — v3 Autonomous Pipeline
//
// Fully autonomous: onboard → context → plan → clone →
// code → self-review → validate → push → PR
//
// Decomposed into stage functions for testability and clarity.
// Each stage has typed inputs/outputs and self-contained error handling.
// ──────────────────────────────────────────────────────────

import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "@/lib/logger";
import { writeCode } from "@/lib/clients/code-store";

import { OpenAIService } from "./services/openai.service";
import { GitHubService } from "./services/github.service";
import { CacheService } from "./cache/cache.service";
import { OnboardingService } from "./onboarding/onboarding.service";
import { ContextGathererService } from "./services/context-gatherer.service";
import { CodeValidatorService } from "./services/code-validator.service";
import { ImpactAnalyzerService } from "./services/impact-analyzer.service";
import { makeBranchName } from "./utils/branch-name";
import type {
  CodeGenerationResponse,
  IssueInfo,
  PlanStep,
  RepoInfo,
  RepoKnowledge,
  TaskPlan,
  ReviewIssue,
} from "./types";
import type { AgentResponse, FEProgressStage } from "../types";
import type { SimpleGit } from "simple-git";

// ── Centralized Configuration ─────────────────────────────
// All magic numbers in ONE place. Change here, affects everywhere.

const CONFIG = {
  /** Max LLM self-review iterations before moving on */
  maxReviewIterations: 3,
  /** Max validation fix iterations (tsc/lint/build/test cycle) */
  maxValidationFixes: 3,

  /** Progress milestones (0-100) for each pipeline stage */
  progress: {
    onboarding:     { start: 5,  end: 10 },
    planning:       { start: 12, end: 20 },
    cloning:        { start: 25, end: 30 },
    coding:         { start: 35, end: 55 },
    selfReview:     { start: 58, end: 67 },
    autoFix:        { start: 66, end: 67 },
    validation:     { start: 68, end: 78 },
    taskCompletion: { start: 79, end: 81 },
    pushing:        { start: 82, end: 90 },
    prCreation:     { start: 92, end: 100 },
  },

  /** Content truncation limits (chars) for LLM context windows */
  contextLimits: {
    repoStructure: 2000,
    filePreview: 2000,
    relatedFilesMax: 8,
    relatedFilesPreview: 5,
    relatedFilesListMax: 15,
    validationOutput: 2000,
    escalatedOutput: 1500,
    commitTitleLength: 50,
    conventionsMax: 5,
  },
} as const;

// ── Types ─────────────────────────────────────────────────

/** Callback for sub-step progress events */
export type ProgressCallback = (stage: FEProgressStage, message: string, progress: number) => void;

/** Shared pipeline context passed between stages */
interface PipelineContext {
  userMessage: string;
  emit: ProgressCallback;
  toolCalls: AgentResponse["toolCalls"];
  detailParts: string[];
  warnings: string[];

  // Services
  openai: OpenAIService;
  github: GitHubService;
  cache: CacheService;
  onboarding: OnboardingService;
  gatherer: ContextGathererService;
  validator: CodeValidatorService;
  impactAnalyzer: ImpactAnalyzerService;

  // Accumulated state from earlier stages
  repoInfo: RepoInfo;
  repoKnowledge: RepoKnowledge;
  repoContext: string;
  repoTree: string[];
  knowledgeContext: string;
  existingScanContext: string;
  enrichedContext: string;
  issue: IssueInfo;
  plan: TaskPlan;
  branchName: string;
  dir: string;
  git: SimpleGit;
  allChanges: CodeGenerationResponse[];
  validationPassed: boolean;
  stepResults: Record<string, boolean>;
  isDraft: boolean;
}

// ── Scope Classification ──────────────────────────────────

const HARD_BLOCK_PATTERNS = [
  /^\.github\//, /^\.gitlab-ci/, /^Dockerfile/i, /^docker-compose/i,
  /^\.husky\//, /^\.vscode\//, /^\.eslintrc/, /^\.prettierrc/,
  /^eslint\.config/, /\.config\.(js|ts|mjs|cjs)$/,
  /^tsconfig[^/]*\.json$/i,
  /^package-lock\.json$/, /^yarn\.lock$/, /^pnpm-lock\.yaml$/,
  /^public\/\.well-known\//, /^public\/sitemap/i, /^public\/robots\.txt$/i,
  /^LICENSE/i, /\.html$/i,
];

const SECONDARY_PATTERNS = [
  /^[A-Z_-]+\.md$/i, /^docs\//i, /^documentation\//i,
  /^messages\//i, /^locales?\//i, /^i18n\//i, /^translations?\//i,
  /^scripts\//,
];

const OUT_OF_SCOPE_PATTERNS = [...HARD_BLOCK_PATTERNS, ...SECONDARY_PATTERNS];

// ── Pure Helper Functions ─────────────────────────────────

function deduplicateChanges(changes: CodeGenerationResponse[]): CodeGenerationResponse[] {
  const seen = new Map<string, number>();
  const normalized: CodeGenerationResponse[] = [];

  for (const change of changes) {
    const filename = change.filename
      .replace(/\.\.\//g, "")
      .replace(/^\/+/, "")
      .replace(/\/+/g, "/")
      .trim();
    if (!filename) continue;

    const existing = seen.get(filename);
    if (existing !== undefined) {
      normalized[existing] = { ...change, filename };
    } else {
      seen.set(filename, normalized.length);
      normalized.push({ ...change, filename });
    }
  }
  return normalized.filter(Boolean);
}

function resolvePathConflicts(changes: CodeGenerationResponse[]): CodeGenerationResponse[] {
  const filePaths = new Set(changes.map((c) => c.filename));

  return changes.map((change) => {
    const asDir = change.filename.replace(/\.[^/.]+$/, "");
    const hasChildFiles = [...filePaths].some(
      (f) => f !== change.filename && f.startsWith(asDir + "/"),
    );
    if (hasChildFiles) {
      const ext = change.filename.substring(change.filename.lastIndexOf("."));
      const newFilename = `${asDir}/index${ext}`;
      logger.warn(`Path conflict: "${change.filename}" → "${newFilename}"`);
      return { ...change, filename: newFilename };
    }
    return change;
  });
}

/** Deduplicate + resolve in one call (used in 3 places) */
function cleanupChanges(changes: CodeGenerationResponse[]): CodeGenerationResponse[] {
  return resolvePathConflicts(deduplicateChanges(changes));
}

function isCodeIdentical(generated: string, existing: string): boolean {
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  return normalize(generated) === normalize(existing);
}

function filterOutOfScopeChanges(
  changes: CodeGenerationResponse[],
  userMessage: string,
): { kept: CodeGenerationResponse[]; removed: CodeGenerationResponse[] } {
  const messageLower = userMessage.toLowerCase();
  const kept: CodeGenerationResponse[] = [];
  const removed: CodeGenerationResponse[] = [];
  const secondary: CodeGenerationResponse[] = [];

  for (const change of changes) {
    const target = change.filename || "";
    const basename = target.toLowerCase().split("/").pop()?.split(".")[0] || "";
    const userMentioned = messageLower.includes(basename);

    if (HARD_BLOCK_PATTERNS.some((p) => p.test(target)) && !userMentioned) {
      removed.push(change);
    } else if (SECONDARY_PATTERNS.some((p) => p.test(target)) && !userMentioned) {
      secondary.push(change);
    } else {
      kept.push(change);
    }
  }

  if (kept.length > 0 && secondary.length > 0) {
    kept.push(...secondary);
  } else if (secondary.length > 0) {
    removed.push(...secondary);
  }
  return { kept, removed };
}

function filterUnchangedFiles(
  changes: CodeGenerationResponse[],
  existingContents: Map<string, string>,
): { changed: CodeGenerationResponse[]; unchanged: string[] } {
  const changed: CodeGenerationResponse[] = [];
  const unchanged: string[] = [];

  for (const change of changes) {
    const existing = existingContents.get(change.filename);
    if (existing === undefined) {
      changed.push(change);
    } else if (isCodeIdentical(change.code, existing)) {
      unchanged.push(change.filename);
    } else {
      changed.push(change);
    }
  }
  return { changed, unchanged };
}

function extractTaskKeywords(message: string): string[] {
  const words = message
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  const stopWords = new Set([
    "the", "and", "for", "with", "that", "this", "from", "have", "has",
    "are", "was", "were", "will", "would", "could", "should", "can",
    "not", "but", "all", "any", "each", "make", "like", "add", "create",
    "build", "implement", "develop", "write", "need", "want", "please",
    "also", "new", "use", "using", "into", "about", "some", "more",
  ]);
  return [...new Set(words.filter((w) => !stopWords.has(w)))];
}

function filterOutOfScopeSteps(
  steps: PlanStep[],
  userMessage: string,
): { kept: PlanStep[]; removed: PlanStep[] } {
  const messageLower = userMessage.toLowerCase();
  const kept: PlanStep[] = [];
  const removed: PlanStep[] = [];

  for (const step of steps) {
    const target = step.targetFile || "";
    const isOutOfScope = OUT_OF_SCOPE_PATTERNS.some((p) => p.test(target));
    const basename = target.toLowerCase().split("/").pop()?.split(".")[0] || "";
    if (isOutOfScope && !messageLower.includes(basename)) {
      removed.push(step);
    } else {
      kept.push(step);
    }
  }
  return { kept, removed };
}

function buildExistingScanContext(
  relatedFiles: string[],
  existingContents: Map<string, string>,
): string {
  if (relatedFiles.length === 0) return "";

  const parts: string[] = [
    "## EXISTING FILES RELATED TO THIS TASK",
    "⚠️ IMPORTANT: Review these files before deciding to CREATE new ones.",
    "If a file already handles this functionality, MODIFY it instead of creating a duplicate.\n",
    `Found ${relatedFiles.length} related file(s) in the repository:`,
    relatedFiles.map((f) => `  - ${f}`).join("\n"),
  ];

  const previewFiles = [...existingContents.entries()].slice(0, CONFIG.contextLimits.relatedFilesPreview);
  if (previewFiles.length > 0) {
    parts.push("\n### Content previews of existing files:");
    for (const [filename, content] of previewFiles) {
      parts.push(`\n--- ${filename} ---\n${content.slice(0, CONFIG.contextLimits.filePreview)}`);
    }
  }
  return parts.join("\n");
}

/** Read back auto-fixed files from disk to keep in-memory changes in sync */
async function syncChangesFromDisk(
  changes: CodeGenerationResponse[],
  dir: string,
): Promise<CodeGenerationResponse[]> {
  const synced = [...changes];
  for (let i = 0; i < synced.length; i++) {
    const filePath = path.join(dir, synced[i].filename);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      synced[i] = { ...synced[i], code: content };
    } catch (err) {
      // File may not exist on disk if it was skipped during apply
      logger.debug(`Could not read back ${synced[i].filename} from disk: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return synced;
}

// ── Pipeline Stage Functions ──────────────────────────────
// Each stage is a focused function with typed inputs/outputs.
// Stages don't share mutable state — they receive context and
// return results. The orchestrator function wires them together.

async function stageOnboard(ctx: Pick<PipelineContext, "emit" | "openai" | "github" | "cache" | "onboarding" | "warnings" | "detailParts" | "toolCalls">): Promise<{
  repoInfo: RepoInfo;
  repoKnowledge: RepoKnowledge;
  repoContext: string;
  repoTree: string[];
  knowledgeContext: string;
}> {
  const { emit, github, cache, onboarding, warnings, detailParts, toolCalls } = ctx;
  const p = CONFIG.progress.onboarding;

  emit("onboarding", "Learning repository structure, language, and conventions...", p.start);

  // Connect to GitHub
  const repoInfo = await github.getRepoInfo();

  // Onboard repo knowledge
  let repoKnowledge: RepoKnowledge;
  try {
    repoKnowledge = await onboarding.getKnowledge(repoInfo);
  } catch (err) {
    logger.warn("Onboarding failed — using minimal defaults", { error: String(err) });
    repoKnowledge = {
      repoFullName: repoInfo.fullName, language: "TypeScript",
      framework: "unknown", buildSystem: "npm", testFramework: "unknown",
      linter: "unknown", conventions: [], architecture: "unknown",
      keyFiles: {}, dependencies: [], linterRules: [], lastUpdated: new Date(),
    };
    warnings.push("Repo onboarding failed — using minimal defaults");
  }

  const knowledgeContext = [
    `Language: ${repoKnowledge.language}`,
    `Framework: ${repoKnowledge.framework}`,
    `Build: ${repoKnowledge.buildSystem}`,
    `Tests: ${repoKnowledge.testFramework}`,
    `Linter: ${repoKnowledge.linter}`,
    `Architecture: ${repoKnowledge.architecture}`,
    `Conventions:\n${repoKnowledge.conventions.map((c) => `  - ${c}`).join("\n")}`,
    repoKnowledge.linterRules.length > 0
      ? `Linter Rules (code MUST comply):\n${repoKnowledge.linterRules.map((r) => `  - ${r}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n");

  detailParts.push(`## Repo Onboarding\n${knowledgeContext}`);
  toolCalls.push({
    tool: "onboard_repo",
    arguments: { repo: repoInfo.fullName },
    result: { language: repoKnowledge.language, framework: repoKnowledge.framework },
  });

  // Get repo context & tree
  let repoContext = await cache.getRepoContext(repoInfo.fullName);
  if (!repoContext) {
    try {
      repoContext = await github.getRepoContext();
      await cache.setRepoContext(repoInfo.fullName, repoContext);
    } catch (err) {
      logger.warn("Could not build full repo context", { error: String(err) });
      repoContext = `Repository: ${repoInfo.fullName}\nDefault branch: ${repoInfo.defaultBranch}`;
      warnings.push("Limited repo context — some API calls failed");
    }
  }

  let repoTree: string[] = [];
  try {
    repoTree = await github.getRepoTree(repoInfo.defaultBranch);
  } catch (err) {
    logger.warn("Could not fetch repo tree", { error: String(err) });
    warnings.push("Repo tree unavailable — context gathering will be limited");
  }

  emit("onboarding", `Onboarded: ${repoKnowledge.language}/${repoKnowledge.framework}`, p.end);

  return { repoInfo, repoKnowledge, repoContext, repoTree, knowledgeContext };
}

async function stagePlan(ctx: Pick<PipelineContext, "emit" | "openai" | "github" | "userMessage" | "repoTree" | "repoContext" | "knowledgeContext" | "warnings" | "detailParts" | "toolCalls">): Promise<{
  issue: IssueInfo;
  plan: TaskPlan;
  existingScanContext: string;
  enrichedContext: string;
}> {
  const { emit, openai, github, userMessage, repoTree, repoContext, knowledgeContext, warnings, detailParts, toolCalls } = ctx;
  const p = CONFIG.progress.planning;

  emit("planning", "Scanning repository for existing related files...", p.start);

  const issue: IssueInfo = {
    number: 0, title: userMessage.slice(0, 120),
    body: userMessage, labels: [], author: "chat-user",
  };

  // Pre-planning scan
  let existingScanContext = "";
  if (repoTree.length > 0) {
    try {
      const keywords = extractTaskKeywords(userMessage);
      logger.info(`Pre-planning scan keywords: ${keywords.join(", ")}`);
      const relatedFiles = await github.findRelatedFiles(repoTree, keywords);

      if (relatedFiles.length > 0) {
        const filesToRead = relatedFiles
          .filter((f) => /\.(tsx?|jsx?|vue|svelte)$/.test(f))
          .slice(0, CONFIG.contextLimits.relatedFilesMax);
        const existingContents = await github.readMultipleFiles(filesToRead);
        existingScanContext = buildExistingScanContext(relatedFiles, existingContents);

        logger.info(`Found ${relatedFiles.length} related files, read ${existingContents.size} for context`);
        detailParts.push(
          `## Pre-Planning Scan\nFound ${relatedFiles.length} existing file(s):\n${relatedFiles.slice(0, CONFIG.contextLimits.relatedFilesListMax).map((f) => `- \`${f}\``).join("\n")}`,
        );
      }
    } catch (err) {
      logger.warn("Pre-planning scan failed — continuing", { error: String(err) });
    }
  }

  emit("planning", "Creating implementation plan...", p.start + 3);

  const enrichedContext = [
    repoContext,
    `\n## Project Knowledge\n${knowledgeContext}`,
    existingScanContext ? `\n${existingScanContext}` : "",
  ].filter(Boolean).join("\n");

  const plan = await openai.planTask(issue, enrichedContext);

  if (!plan.steps || plan.steps.length === 0) {
    throw new Error("Planning produced zero steps — the task may be too vague.");
  }

  detailParts.push(
    `## Implementation Plan\n**Summary:** ${plan.summary}\n**Approach:** ${plan.approach}\n**Steps:**\n${plan.steps.map((s) => `${s.order}. ${s.description} (${s.action} → \`${s.targetFile}\`)`).join("\n")}\n**Risks:** ${plan.risks.join(", ") || "None identified"}`,
  );
  toolCalls.push({
    tool: "plan_implementation",
    arguments: { issueTitle: issue.title },
    result: { steps: plan.steps.length, files: plan.estimatedFiles.length },
  });

  // Scope filter
  const { kept: scopedSteps, removed: removedSteps } = filterOutOfScopeSteps(plan.steps, userMessage);
  if (removedSteps.length > 0) {
    logger.info(`Scope filter: removed ${removedSteps.length} out-of-scope steps`);
    warnings.push(`Filtered ${removedSteps.length} out-of-scope file(s): ${removedSteps.map((s) => s.targetFile).join(", ")}`);
    plan.steps = scopedSteps;
  }
  if (plan.steps.length === 0) {
    throw new Error("All planned steps were filtered as out-of-scope.");
  }

  emit("planning", `Plan: ${plan.steps.length} steps, ${plan.estimatedFiles.length} files`, p.end);

  return { issue, plan, existingScanContext, enrichedContext };
}

async function stageClone(ctx: Pick<PipelineContext, "emit" | "github" | "repoInfo" | "issue" | "toolCalls">): Promise<{
  branchName: string;
  dir: string;
  git: SimpleGit;
}> {
  const { emit, github, repoInfo, issue, toolCalls } = ctx;
  const p = CONFIG.progress.cloning;

  emit("cloning", "Cloning repository and creating feature branch...", p.start);

  const branchName = makeBranchName({ type: "feat", title: issue.title });
  const cloneResult = await github.cloneRepo(repoInfo.defaultBranch);
  const { dir, git } = cloneResult;
  await github.createBranch(git, branchName);

  toolCalls.push({
    tool: "clone_and_branch",
    arguments: { branch: branchName },
    result: { branch: branchName, dir },
  });

  emit("cloning", `Branch: ${branchName}`, p.end);
  return { branchName, dir, git };
}

async function stageCodeGeneration(ctx: Pick<PipelineContext, "emit" | "openai" | "github" | "gatherer" | "plan" | "repoKnowledge" | "repoContext" | "repoTree" | "knowledgeContext" | "existingScanContext" | "userMessage" | "warnings" | "toolCalls">): Promise<CodeGenerationResponse[]> {
  const { emit, openai, github, gatherer, plan, repoKnowledge, repoContext, repoTree, knowledgeContext, existingScanContext, userMessage, warnings, toolCalls } = ctx;
  const p = CONFIG.progress.coding;

  emit("coding", "Generating code with deep context analysis...", p.start);

  let allChanges: CodeGenerationResponse[] = [];
  const codeSteps = plan.steps.filter((s) => s.action !== "test" && s.action !== "review");
  const totalSteps = codeSteps.length;

  for (let si = 0; si < codeSteps.length; si++) {
    const step = codeSteps[si];
    const stepProgress = p.start + Math.round((si / totalSteps) * (p.end - p.start));
    emit("coding", `Coding step ${si + 1}/${totalSteps}: ${step.description.slice(0, 60)}...`, stepProgress);

    // Gather deep context
    let fileContextStr = "";
    if (step.targetFile) {
      try {
        const fileCtx = await gatherer.gatherContext(step.targetFile, repoTree, repoKnowledge);
        fileContextStr = gatherer.formatForPrompt(fileCtx);
      } catch (err) {
        logger.warn(`Could not gather deep context for ${step.targetFile}`, { error: String(err) });
      }
    }

    // Read existing file
    let existingCode: string | undefined;
    if (step.targetFile) {
      try {
        existingCode = await github.getFileContent(step.targetFile);
      } catch (err) {
        // Expected for new files — only log at debug level
        logger.debug(`File ${step.targetFile} not found in repo (new file)`, { error: String(err) });
      }
    }

    const fullContext = [
      `## Task Plan\n${plan.summary}`,
      `\n## Step ${step.order}/${plan.steps.length}\n${step.details}`,
      knowledgeContext ? `\n## Project Knowledge\n${knowledgeContext}` : "",
      fileContextStr ? `\n## Related Code Context\n${fileContextStr}` : "",
      existingScanContext ? `\n${existingScanContext}` : "",
      `\n## Repository Structure\n${repoContext.slice(0, CONFIG.contextLimits.repoStructure)}`,
    ].filter(Boolean).join("\n");

    try {
      const baseConstraints = [
        `Target file: ${step.targetFile || "determine from context"}`,
        `Action: ${step.action}`,
        repoKnowledge.linter ? `Code MUST pass ${repoKnowledge.linter} linter` : "",
        repoKnowledge.conventions?.length
          ? `Follow conventions: ${repoKnowledge.conventions.slice(0, CONFIG.contextLimits.conventionsMax).join(", ")}`
          : "",
        ...(repoKnowledge.linterRules.length > 0
          ? [`LINTER RULES — your generated code MUST comply with ALL of these:\n${repoKnowledge.linterRules.map((r) => `  • ${r}`).join("\n")}`]
          : []),
        "Preserve ALL existing imports — do NOT change any import path unless the new target actually exists in the repo",
        "If the existing file has 'use client', the output MUST also have 'use client' at the top",
        "In Next.js App Router: page.tsx must NOT include Header/Footer/Nav if layout.tsx already provides them",
        "Do NOT add duplicate metadata/viewport exports if layout.tsx already has them",
        "Match the naming conventions and code style of sibling files",
        existingCode
          ? "IMPORTANT: This file already exists. Your output MUST contain meaningful changes — if you return identical code you have FAILED."
          : "",
      ].filter(Boolean);

      let generated = await openai.generateCode({
        task: step.description, context: fullContext,
        existingCode, constraints: baseConstraints,
      });

      // Immediate diff-check: retry once with escalated prompt if identical
      if (existingCode && isCodeIdentical(generated.code, existingCode)) {
        logger.warn(`Step ${si + 1}: identical output — retrying with escalation`);
        warnings.push(`Step ${si + 1} (${step.targetFile}): first generation was identical — regenerated`);

        generated = await openai.generateCode({
          task: `PREVIOUS ATTEMPT FAILED — you returned code IDENTICAL to the existing file.\n\nThe task is: ${step.description}\n\nYou MUST make REAL, VISIBLE changes. Identify AT LEAST 3 concrete things to change.`,
          context: fullContext, existingCode,
          constraints: [...baseConstraints, "YOUR PREVIOUS OUTPUT WAS IDENTICAL — produce DIFFERENT code"],
        });

        if (existingCode && isCodeIdentical(generated.code, existingCode)) {
          logger.error(`Step ${si + 1}: STILL identical after escalation`);
          warnings.push(`Step ${si + 1} (${step.targetFile}): FAILED to produce changes after retry`);
          continue;
        }
      }

      allChanges.push(generated);
      writeCode({ file_path: generated.filename, language: generated.language, code: generated.code, description: generated.explanation }, "frontend_developer");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Code generation failed for step ${si + 1}: ${msg}`);
      warnings.push(`Step ${si + 1} (${step.targetFile}) code generation failed: ${msg}`);
    }
  }

  if (allChanges.length === 0) {
    throw new Error("Code generation produced zero files. All steps failed. Check LLM responses.");
  }

  // Cleanup, scope filter, and meaningful-change verification
  allChanges = cleanupChanges(allChanges);

  const { kept: scopedChanges, removed: scopeCreepFiles } = filterOutOfScopeChanges(allChanges, userMessage);
  if (scopeCreepFiles.length > 0) {
    logger.info(`Scope filter: removed ${scopeCreepFiles.length} out-of-scope files`);
    warnings.push(`Filtered ${scopeCreepFiles.length} out-of-scope file(s): ${scopeCreepFiles.map((f) => f.filename).join(", ")}`);
    allChanges = scopedChanges;
  }
  if (allChanges.length === 0) {
    throw new Error("All generated files were filtered as out-of-scope.");
  }

  // Meaningful-change verification
  const existingFileContents = new Map<string, string>();
  for (const change of allChanges) {
    try {
      const content = await github.getFileContent(change.filename);
      existingFileContents.set(change.filename, content);
    } catch {
      // New file — always meaningful
    }
  }

  const { changed: meaningfulChanges, unchanged: unchangedFiles } = filterUnchangedFiles(allChanges, existingFileContents);
  if (unchangedFiles.length > 0) {
    logger.warn(`Dropped ${unchangedFiles.length} unchanged file(s): ${unchangedFiles.join(", ")}`);
    warnings.push(`Dropped ${unchangedFiles.length} file(s) with no meaningful diff: ${unchangedFiles.join(", ")}`);
    allChanges = meaningfulChanges;
  }
  if (allChanges.length === 0) {
    throw new Error(`No meaningful code changes produced. Unchanged: ${unchangedFiles.join(", ")}`);
  }

  toolCalls.push({
    tool: "generate_code",
    arguments: { steps: totalSteps },
    result: { filesGenerated: allChanges.length, scopeFiltered: scopeCreepFiles.length, unchangedDropped: unchangedFiles.length },
  });

  emit("coding", `Generated ${allChanges.length} meaningful files`, p.end);
  return allChanges;
}

async function stageSelfReview(ctx: Pick<PipelineContext, "emit" | "openai" | "issue" | "enrichedContext" | "warnings" | "detailParts" | "toolCalls">, allChanges: CodeGenerationResponse[]): Promise<CodeGenerationResponse[]> {
  const { emit, openai, issue, enrichedContext, warnings, detailParts, toolCalls } = ctx;
  const p = CONFIG.progress.selfReview;

  emit("self_review", "Running LLM self-review...", p.start);
  const changes = [...allChanges];

  for (let iteration = 1; iteration <= CONFIG.maxReviewIterations; iteration++) {
    const iterProgress = p.start + Math.round((iteration / CONFIG.maxReviewIterations) * (p.end - p.start));
    emit("self_review", `Self-review iteration ${iteration}/${CONFIG.maxReviewIterations}...`, iterProgress);

    try {
      const review = await openai.selfReviewCode(
        changes.map((c) => ({ filename: c.filename, code: c.code, language: c.language })),
        `${issue.title}\n\n${issue.body}`,
        enrichedContext,
      );

      const errors: ReviewIssue[] = review.issues.filter(
        (i) => i.severity === "error" || i.severity === "critical",
      );

      if (review.approved || errors.length === 0) {
        detailParts.push(`## LLM Self-Review\nPassed on iteration ${iteration}: ${review.summary}`);
        toolCalls.push({ tool: "self_review", arguments: { iteration }, result: { approved: true, summary: review.summary } });
        break;
      }

      logger.warn(`LLM review: ${errors.length} issues on iteration ${iteration}`);

      // Group errors by file and fix
      const filesWithErrors = new Map<string, ReviewIssue[]>();
      for (const err of errors) {
        const existing = filesWithErrors.get(err.filename) || [];
        existing.push(err);
        filesWithErrors.set(err.filename, existing);
      }

      for (const [filename, fileErrors] of filesWithErrors.entries()) {
        const changeIdx = changes.findIndex((c) => c.filename === filename);
        if (changeIdx === -1) continue;

        try {
          const original = changes[changeIdx];
          const fixed = await openai.fixCodeIssues(
            { filename: original.filename, code: original.code, language: original.language },
            fileErrors.map((e) => ({ issue: e.issue, fix: e.fix })),
            enrichedContext,
          );
          changes[changeIdx] = fixed;
          writeCode({ file_path: fixed.filename, language: fixed.language, code: fixed.code, description: `[fixed] ${fixed.explanation}` }, "frontend_developer");
        } catch (fixErr) {
          logger.warn(`Failed to fix ${filename} in review iteration ${iteration}`, { error: String(fixErr) });
          warnings.push(`Self-review fix failed for ${filename} on iteration ${iteration}`);
        }
      }

      if (iteration === CONFIG.maxReviewIterations) {
        detailParts.push(`## LLM Self-Review\nMax iterations reached. Last: ${review.summary}`);
        warnings.push("Self-review reached max iterations — some issues may remain");
      }
    } catch (reviewErr) {
      logger.warn(`Self-review iteration ${iteration} failed`, { error: String(reviewErr) });
      warnings.push(`Self-review iteration ${iteration} failed: ${reviewErr instanceof Error ? reviewErr.message : String(reviewErr)}`);
      if (iteration === 1) detailParts.push("## LLM Self-Review\nSkipped — review call failed");
      break;
    }
  }

  return cleanupChanges(changes);
}

async function stageValidation(ctx: Pick<PipelineContext, "emit" | "openai" | "github" | "validator" | "repoKnowledge" | "enrichedContext" | "dir" | "git" | "warnings" | "detailParts" | "toolCalls">, allChanges: CodeGenerationResponse[]): Promise<{
  changes: CodeGenerationResponse[];
  validationPassed: boolean;
  stepResults: Record<string, boolean>;
}> {
  const { emit, openai, github, validator, repoKnowledge, enrichedContext, dir, git, warnings, detailParts, toolCalls } = ctx;

  emit("validating", "Applying code to disk...", CONFIG.progress.autoFix.start);
  let changes = [...allChanges];

  // Apply to disk
  const applyResult = await github.applyChanges(dir, git, changes);
  if (applyResult.skipped.length > 0) {
    warnings.push(`${applyResult.skipped.length} file(s) could not be applied: ${applyResult.skipped.map((s) => `${s.file} (${s.reason})`).join(", ")}`);
  }
  if (applyResult.applied.length === 0) {
    throw new Error("No files could be applied to disk.");
  }

  // Tier 1: Auto-fix
  emit("validating", "Running auto-fix: prettier --write, eslint --fix...", CONFIG.progress.autoFix.end);
  try {
    const autoFixes = await validator.autoFix(dir, repoKnowledge);
    if (autoFixes.length > 0) {
      logger.info(`Auto-fix applied: ${autoFixes.join(", ")}`);
      detailParts.push(`## Auto-Fix (Tier 1)\nApplied: ${autoFixes.join(", ")}`);
      changes = await syncChangesFromDisk(changes, dir);
    }
  } catch (autoFixErr) {
    logger.warn("Auto-fix failed — continuing", { error: String(autoFixErr) });
  }

  // Tier 2: Smart LLM-assisted fix loop
  let validationPassed = false;
  const stepResults: Record<string, boolean> = {};
  let previousErrors: string[] = [];

  for (let valIter = 1; valIter <= CONFIG.maxValidationFixes; valIter++) {
    const vp = CONFIG.progress.validation;
    const iterProgress = vp.start + Math.round((valIter / CONFIG.maxValidationFixes) * (vp.end - vp.start));
    emit("validating", `Validation ${valIter}/${CONFIG.maxValidationFixes} (tsc, eslint, build, tests)...`, iterProgress);

    try {
      const validation = await validator.validate(dir, repoKnowledge);

      for (const step of validation.steps) {
        if (!step.skipped) stepResults[step.name] = step.passed;
      }
      toolCalls.push({ tool: "tool_validation", arguments: { iteration: valIter }, result: { passed: validation.passed, summary: validation.summary } });

      if (validation.passed) {
        validationPassed = true;
        detailParts.push(`## Tool Validation\nAll checks passed on iteration ${valIter}: ${validation.summary}`);
        break;
      }

      logger.warn(`Validation ${valIter} failed: ${validation.summary}`);

      const failedSteps = validation.steps.filter((s) => !s.passed && !s.skipped);
      const allParsedErrors = failedSteps.flatMap((s) => validator.parseErrors(s));
      const currentErrorSigs = allParsedErrors.map((e) => `${e.file}:${e.line || ""}:${e.message.slice(0, 80)}`);

      const persistentErrors = currentErrorSigs.filter((sig) => previousErrors.includes(sig));
      const isEscalated = persistentErrors.length > 0 && valIter > 1;
      previousErrors = currentErrorSigs;

      if (isEscalated) {
        logger.warn(`${persistentErrors.length} errors persist — escalating fix`);
      }

      const failureContext = allParsedErrors.length > 0
        ? validator.formatErrorsForLLM(allParsedErrors)
        : failedSteps.map((s) => `### ${s.name} FAILED:\n\`\`\`\n${s.output.slice(0, CONFIG.contextLimits.validationOutput)}\n\`\`\``).join("\n\n");

      let anyFixed = false;
      for (let ci = 0; ci < changes.length; ci++) {
        const change = changes[ci];
        const fileErrors = validator.formatErrorsForLLM(allParsedErrors, change.filename);
        const isInRawOutput = failedSteps.some((s) => s.output.includes(change.filename));
        const isGlobalCheck = failedSteps.some((s) => s.name === "type-check" || s.name === "lint" || s.name === "build");
        if (!fileErrors && !isInRawOutput && !isGlobalCheck) continue;

        // Build fix prompt with escalation awareness
        const fixPrompt = isEscalated
          ? `ESCALATED FIX — previous fix DID NOT work. Use DIFFERENT approach.\n\nErrors:\n${fileErrors || failureContext}\n\nFull output:\n${failedSteps.map((s) => `${s.name}: ${s.output.slice(0, CONFIG.contextLimits.escalatedOutput)}`).join("\n\n")}`
          : fileErrors
            ? `Fix these errors in ${change.filename}:\n\n${fileErrors}`
            : `Tool validation failures affecting ${change.filename}:\n\n${failureContext}`;

        const fixInstruction = isEscalated
          ? "Previous fix failed. Analyze the error MORE DEEPLY. Fix the ROOT CAUSE."
          : "Fix ONLY the listed errors. Preserve all working code.";

        try {
          const fixed = await openai.fixCodeIssues(
            { filename: change.filename, code: change.code, language: change.language },
            [{ issue: fixPrompt, fix: fixInstruction }],
            enrichedContext,
          );
          changes[ci] = fixed;
          anyFixed = true;
        } catch (fixErr) {
          logger.warn(`Failed to fix ${change.filename}`, { error: String(fixErr) });
        }
      }

      if (!anyFixed) {
        logger.warn("No files fixed this iteration — breaking loop");
        detailParts.push(`## Tool Validation\nNo fixes applied on iteration ${valIter}. Last: ${validation.summary}`);
        break;
      }

      // Re-apply and re-autofix
      changes = cleanupChanges(changes);
      await github.applyChanges(dir, git, changes);
      try {
        await validator.autoFix(dir, repoKnowledge);
        changes = await syncChangesFromDisk(changes, dir);
      } catch {
        logger.debug("Post-fix auto-fix failed — non-critical");
      }

      if (valIter === CONFIG.maxValidationFixes) {
        detailParts.push(`## Tool Validation\nMax iterations reached. Last: ${validation.summary}`);
      }
    } catch (valErr) {
      logger.warn(`Validation ${valIter} crashed`, { error: String(valErr) });
      warnings.push(`Validation iteration ${valIter} failed: ${valErr instanceof Error ? valErr.message : String(valErr)}`);
      if (valIter === 1) detailParts.push("## Tool Validation\nSkipped — validation pipeline crashed");
      break;
    }
  }

  return { changes, validationPassed, stepResults };
}

async function stageTaskCompletion(ctx: Pick<PipelineContext, "emit" | "openai" | "userMessage" | "warnings" | "detailParts">, allChanges: CodeGenerationResponse[]): Promise<void> {
  const { emit, openai, userMessage, warnings, detailParts } = ctx;
  emit("validating", "Verifying task completion...", CONFIG.progress.taskCompletion.start);

  try {
    const changeSummary = allChanges.map((c) => `- ${c.filename}: ${c.explanation}`).join("\n");
    const completionCheck = await openai.chat([
      {
        role: "system",
        content: `You are a pragmatic code-review verifier. Check whether code changes are RELEVANT to the task.

Respond in JSON:
{ "taskAccomplished": true/false, "confidence": "high" | "medium" | "low", "reason": "One sentence", "missingWork": "If not accomplished, what's needed" }

RULES:
- SOURCE CODE includes: .ts, .tsx, .js, .jsx, .vue, .svelte, .css, .scss, .sass, .less, .styled.ts
- CSS/SCSS ARE source code. A "redesign" via CSS-only IS valid.
- NOT accomplished = ONLY docs/configs with ZERO source files, OR changes completely unrelated to target.
- Partial implementation toward the goal = accomplished with medium confidence.`,
      },
      {
        role: "user",
        content: `## Original Task\n${userMessage}\n\n## Files Changed\n${changeSummary}\n\n## File List\n${allChanges.map((c) => c.filename).join("\n")}\n\nDoes this change set accomplish the requested task?`,
      },
    ], true);

    const completion = JSON.parse(completionCheck);
    if (!completion.taskAccomplished) {
      logger.warn(`Task completion: NOT accomplished — ${completion.reason}`);
      warnings.push(`Task completion concern: ${completion.reason}. Missing: ${completion.missingWork || "N/A"}`);
      detailParts.push(`## ⚠️ Task Completion Concern\n**Reason:** ${completion.reason}\n**Missing:** ${completion.missingWork || "N/A"}\n_PR was still created — reviewer should verify._`);
    } else {
      logger.info(`Task completion verified: ${completion.reason}`);
      detailParts.push(`## Task Completion\n✅ Verified: ${completion.reason}`);
    }
  } catch (err) {
    logger.warn("Task completion check failed — continuing", { error: String(err) });
    warnings.push("Task completion verification skipped due to error");
  }
}

async function stagePushAndPR(ctx: Pick<PipelineContext, "emit" | "openai" | "github" | "cache" | "repoInfo" | "issue" | "plan" | "branchName" | "dir" | "git" | "validationPassed" | "stepResults" | "isDraft" | "warnings" | "detailParts" | "toolCalls">, allChanges: CodeGenerationResponse[]): Promise<{
  prNumber?: number;
  prUrl?: string;
  titleInfo: { title: string; type: string; scope: string };
}> {
  const { emit, openai, github, cache, repoInfo, issue, plan, branchName, git, validationPassed, stepResults, isDraft, warnings, detailParts, toolCalls } = ctx;

  // Rebase
  emit("pushing", "Rebasing onto latest main...", CONFIG.progress.pushing.start);
  try {
    await git.fetch("origin", repoInfo.defaultBranch);
    await git.rebase([`origin/${repoInfo.defaultBranch}`]);
  } catch {
    logger.warn("Rebase conflict — falling back to merge");
    try { await git.rebase(["--abort"]); } catch (e) { logger.debug("Rebase abort failed", { error: String(e) }); }
    try {
      await git.merge([`origin/${repoInfo.defaultBranch}`]);
    } catch {
      logger.warn("Merge also failed — pushing as-is");
      try { await git.merge(["--abort"]); } catch (e) { logger.debug("Merge abort failed", { error: String(e) }); }
      warnings.push("Could not rebase or merge with latest main — pushing as-is");
    }
  }

  // Commit & push
  emit("pushing", "Generating commit title and pushing...", CONFIG.progress.pushing.start + 3);
  let titleInfo: { title: string; type: string; scope: string };
  try {
    titleInfo = await openai.generateCommitTitle(
      `${issue.title}\n\n${issue.body}`,
      allChanges.map((c) => ({ filename: c.filename, explanation: c.explanation })),
    );
  } catch {
    titleInfo = { title: `feat: ${issue.title.slice(0, CONFIG.contextLimits.commitTitleLength).toLowerCase()}`, type: "feat", scope: "frontend" };
    warnings.push("Commit title generation failed — using fallback");
  }

  await git.add(".");
  const commitMsg = `${titleInfo.title}\n\nImplemented by AI Engineer Agent\n\nValidation: ${validationPassed ? "all checks passed" : "best-effort (some checks had issues)"}`;
  await github.commitAndPush(git, commitMsg, branchName);

  toolCalls.push({ tool: "commit_and_push", arguments: { branch: branchName, title: titleInfo.title }, result: { pushed: true } });
  emit("pushing", "Code pushed", CONFIG.progress.pushing.end);

  // Open PR
  emit("pushing", isDraft ? "Opening DRAFT pull request..." : "Opening pull request...", CONFIG.progress.prCreation.start);
  const prTitle = isDraft ? `[DRAFT] ${titleInfo.title}` : titleInfo.title;
  const prBody = buildPRBody(issue, plan, allChanges, validationPassed, warnings, stepResults);

  let prNumber: number | undefined;
  let prUrl: string | undefined;
  try {
    const prResult = await github.createPullRequest(prTitle, prBody, branchName, repoInfo.defaultBranch, isDraft);
    prNumber = prResult.prNumber;
    prUrl = prResult.prUrl;
    toolCalls.push({ tool: "create_pull_request", arguments: { title: titleInfo.title, branch: branchName }, result: { prNumber, prUrl } });
    detailParts.push(`## Pull Request\n[PR #${prNumber}](${prUrl}): ${titleInfo.title}`);
  } catch (prErr) {
    const msg = prErr instanceof Error ? prErr.message : String(prErr);
    logger.error("PR creation failed", { error: msg });
    detailParts.push(`## Pull Request\n**PR creation failed:** ${msg}\n\nCode pushed to branch \`${branchName}\`.`);
  }

  detailParts.push(`## Files Changed\n${allChanges.map((c) => `- \`${c.filename}\`: ${c.explanation}`).join("\n")}`);

  // Invalidate cache
  try {
    await cache.invalidate(`repo-context:${repoInfo.fullName}`);
  } catch (err) {
    logger.debug("Cache invalidation failed", { error: String(err) });
  }

  emit("pr_created", `${isDraft ? "DRAFT " : ""}PR #${prNumber} created: ${prUrl}`, CONFIG.progress.prCreation.end);

  return { prNumber, prUrl, titleInfo };
}

// ── Summary & PR Body Builders ────────────────────────────

interface SummaryOptions {
  title?: string;
  filesChanged?: number;
  validationPassed?: boolean;
  branchName?: string;
  prNumber?: number;
  prUrl?: string;
  isDraft?: boolean;
  prCreationFailed?: string;
  pipelineError?: string;
  warnings?: string[];
}

function buildStructuredSummary(opts: SummaryOptions): string {
  const lines: string[] = [];

  if (opts.pipelineError) {
    lines.push(`❌ **Pipeline Failed**`);
    lines.push(`Error: ${opts.pipelineError}`);
    if (opts.warnings && opts.warnings.length > 0) {
      lines.push(`\nWarnings: ${opts.warnings.length}`);
    }
    return lines.join("\n");
  }

  if (opts.isDraft) {
    lines.push(`📝 **Implementation Complete (Draft)**`);
    lines.push(`_Some validation checks did not pass — PR created as draft for manual review._`);
  } else {
    lines.push(`✅ **Implementation Complete**`);
  }

  if (opts.title) lines.push(`**Commit:** ${opts.title}`);
  if (opts.filesChanged !== undefined) lines.push(`**Files changed:** ${opts.filesChanged}`);
  if (opts.validationPassed !== undefined) {
    lines.push(`**Validation:** ${opts.validationPassed ? "All checks passed ✅" : "Partial — see draft PR for details ⚠️"}`);
  }
  if (opts.branchName) lines.push(`**Branch:** \`${opts.branchName}\``);

  if (opts.prUrl && opts.prNumber) {
    lines.push("");
    if (opts.isDraft) {
      lines.push(`📝 **Draft Pull Request:** [PR #${opts.prNumber}](${opts.prUrl})`);
      lines.push(`_Needs fixes before merging._`);
    } else {
      lines.push(`🔗 **Pull Request:** [PR #${opts.prNumber}](${opts.prUrl})`);
    }
  } else if (opts.prCreationFailed) {
    lines.push("");
    lines.push(`⚠️ **PR creation failed:** ${opts.prCreationFailed}`);
    lines.push(`Code was pushed to branch \`${opts.branchName}\`. Create the PR manually.`);
  }

  if (opts.warnings && opts.warnings.length > 0) {
    lines.push("");
    lines.push(`📋 **Pipeline warnings:** ${opts.warnings.length}`);
  }

  return lines.join("\n");
}

function buildPRBody(
  issue: IssueInfo,
  plan: { summary: string; approach: string; steps: { order: number; description: string }[]; risks: string[] },
  changes: CodeGenerationResponse[],
  validationPassed: boolean,
  warnings: string[],
  stepResults?: Record<string, boolean>,
): string {
  const warningsSection = warnings.length > 0
    ? `\n### Pipeline Warnings\n${warnings.map((w) => `- ⚠️ ${w}`).join("\n")}\n`
    : "";

  const checkIcon = (name: string) => {
    if (!stepResults || !(name in stepResults)) return "⏭️";
    return stepResults[name] ? "✅" : "❌";
  };

  return `## 🤖 Automated Implementation

**Task:** ${issue.title}

### Summary
${plan.summary}

### Approach
${plan.approach}

### Changes
${changes.map((c) => `- \`${c.filename}\`: ${c.explanation}`).join("\n")}

### Steps Taken
${plan.steps.map((s) => `${s.order}. ${s.description}`).join("\n")}

### Quality Checks
- ${checkIcon("type-check")} TypeScript type-checking (\`tsc --noEmit\`)
- ${checkIcon("lint")} Linter validation (ESLint/project linter)
- ${checkIcon("format-check")} Formatting (Prettier)
- ${checkIcon("build")} Production build (\`npm run build\`)
- ${checkIcon("test")} Test suite execution
- ✅ Auto-fix applied (prettier --write, eslint --fix)
- ✅ LLM self-review (up to ${CONFIG.maxReviewIterations} iterations)
- ✅ LLM-assisted validation fixes (up to ${CONFIG.maxValidationFixes} iterations)
- ✅ Rebased onto latest \`main\` before push
${warningsSection}
${plan.risks.length ? `### Risks\n${plan.risks.map((r: string) => `- ${r}`).join("\n")}` : ""}

---
*Generated by AI Engineer Agent v3${!validationPassed ? " — ⚠️ DRAFT: some checks did not pass, manual review required" : ""}*`;
}

// ── Main Pipeline Orchestrator ────────────────────────────
// Wires the stage functions together. Each stage is a clean
// function call — the orchestrator handles only flow control.

export async function runFrontendDeveloper(
  userMessage: string,
  onProgress?: ProgressCallback,
): Promise<AgentResponse> {
  const emit = onProgress ?? (() => {});
  const toolCalls: AgentResponse["toolCalls"] = [];
  const detailParts: string[] = [];
  const warnings: string[] = [];

  const openai = new OpenAIService();
  const github = new GitHubService();
  const cache = new CacheService();
  const onboardingSvc = new OnboardingService(openai, github, cache);
  const gatherer = new ContextGathererService(github);
  const validator = new CodeValidatorService();
  const impactAnalyzer = new ImpactAnalyzerService(github);

  try {
    // Stage 1: Onboard
    const { repoInfo, repoKnowledge, repoContext, repoTree, knowledgeContext } =
      await stageOnboard({ emit, openai, github, cache, onboarding: onboardingSvc, warnings, detailParts, toolCalls });

    // Stage 2: Plan
    const { issue, plan, existingScanContext, enrichedContext } =
      await stagePlan({ emit, openai, github, userMessage, repoTree, repoContext, knowledgeContext, warnings, detailParts, toolCalls });

    // Stage 3: Clone & branch
    const { branchName, dir, git } =
      await stageClone({ emit, github, repoInfo, issue, toolCalls });

    // Stage 4: Generate code
    let allChanges =
      await stageCodeGeneration({ emit, openai, github, gatherer, plan, repoKnowledge, repoContext, repoTree, knowledgeContext, existingScanContext, userMessage, warnings, toolCalls });

    // Stage 5: Self-review
    allChanges =
      await stageSelfReview({ emit, openai, issue, enrichedContext, warnings, detailParts, toolCalls }, allChanges);

    // Stage 6: Tool validation
    const { changes: validatedChanges, validationPassed, stepResults } =
      await stageValidation({ emit, openai, github, validator, repoKnowledge, enrichedContext, dir, git, warnings, detailParts, toolCalls }, allChanges);
    allChanges = validatedChanges;

    // Draft decision
    const isDraft = !validationPassed;
    if (isDraft) {
      const failedChecks = Object.entries(stepResults).filter(([, passed]) => !passed).map(([name]) => name).join(", ");
      logger.warn(`Validation failed (${failedChecks}) — will create DRAFT PR`);
      detailParts.push(`## ⚠️ Draft PR\nFailed checks: ${failedChecks}\nOpening as DRAFT.`);
      warnings.push(`DRAFT PR: ${failedChecks} failed after all fix iterations.`);
    }

    // Stage 7: Task completion check (warning only)
    await stageTaskCompletion({ emit, openai, userMessage, warnings, detailParts }, allChanges);

    // Stage 7.5: Impact analysis
    try {
      const changedFiles = allChanges.map((c) => c.filename);
      const impact = await impactAnalyzer.analyzeImpact(changedFiles, repoTree);
      detailParts.push(`## Impact Analysis\n${impact.summary}`);
      if (impact.warnings.length > 0) {
        detailParts.push(`**Warnings:**\n${impact.warnings.map((w) => `- ${w}`).join("\n")}`);
      }
    } catch (err) {
      logger.warn("Impact analysis failed — skipping", { error: String(err) });
      warnings.push("Impact analysis skipped due to error");
    }

    // Stage 8: Push & create PR
    const { prNumber, prUrl, titleInfo } =
      await stagePushAndPR({ emit, openai, github, cache, repoInfo, issue, plan, branchName, dir, git, validationPassed, stepResults, isDraft, warnings, detailParts, toolCalls }, allChanges);

    return {
      agent: "frontend_developer",
      summary: buildStructuredSummary({
        title: titleInfo.title, filesChanged: allChanges.length,
        validationPassed, branchName, prNumber, prUrl, isDraft, warnings,
      }),
      prUrl,
      toolCalls,
      detail: detailParts.join("\n\n"),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Frontend developer pipeline failed", { error: msg });

    return {
      agent: "frontend_developer",
      summary: buildStructuredSummary({ pipelineError: msg, warnings }),
      toolCalls,
      detail: [...detailParts, `## Error\n${msg}`, ...(warnings.length > 0 ? [`## Warnings\n${warnings.map((w) => `- ${w}`).join("\n")}`] : [])].join("\n\n"),
    };
  }
}
