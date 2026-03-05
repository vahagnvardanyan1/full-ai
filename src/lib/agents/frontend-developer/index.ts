// ──────────────────────────────────────────────────────────
// Frontend Developer Agent — v4 Fast Pipeline
//
// Fully autonomous: onboard → plan → clone → code →
// validate (single pass) → push → PR
//
// v4: Removed multi-iteration self-review and task-completion
// LLM checks. Uses one auto-fix + one LLM fix pass to ship
// clean code fast. QA agent handles verification downstream.
//
// Decomposed into stage functions for testability and clarity.
// Each stage has typed inputs/outputs and self-contained error handling.
// ──────────────────────────────────────────────────────────

import { execSync } from "node:child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { createGitHubPullRequest } from "@/lib/clients/github";
import { writeCode } from "@/lib/clients/code-store";
import { logger } from "@/lib/logger";

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
} from "./types";
import type { AgentResponse, FEProgressStage } from "../types";
import type { SimpleGit } from "simple-git";

// ── Helpers ─────────────────────────────────────────────

/** Returns true if the system `git` binary is available (e.g. not in serverless). */
function isGitAvailable(): boolean {
  try {
    execSync("git --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/** Infer code-store language from file extension (for API-only PR path). */
function languageFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if ([".tsx", ".ts"].includes(ext)) return "typescript";
  if ([".jsx", ".js", ".mjs", ".cjs"].includes(ext)) return "javascript";
  if (ext === ".css") return "css";
  if (ext === ".json") return "json";
  if (ext === ".md") return "markdown";
  return "typescript";
}

// ── Centralized Configuration ─────────────────────────────
// All magic numbers in ONE place. Change here, affects everywhere.

const CONFIG = {
  /** Progress milestones (0-100) for each pipeline stage */
  progress: {
    onboarding:     { start: 5,  end: 10 },
    planning:       { start: 12, end: 20 },
    cloning:        { start: 25, end: 30 },
    coding:         { start: 35, end: 60 },
    autoFix:        { start: 62, end: 68 },
    validation:     { start: 70, end: 82 },
    pushing:        { start: 84, end: 92 },
    prCreation:     { start: 94, end: 100 },
  },

  /** Content truncation limits (chars) for LLM context windows */
  contextLimits: {
    repoStructure: 4000,
    filePreview: 3000,
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

/**
 * Lightweight, non-LLM check: does at least one changed file's name or
 * explanation contain a keyword from the user's request?  Returns a warning
 * string when nothing matches, or `null` when the changes look relevant.
 */
function quickTaskRelevanceCheck(
  userMessage: string,
  changes: CodeGenerationResponse[],
): string | null {
  const keywords = extractTaskKeywords(userMessage);
  if (keywords.length === 0) return null; // nothing to check against

  const haystack = changes
    .map((c) => `${c.filename} ${c.explanation}`.toLowerCase())
    .join(" ");

  const matched = keywords.some((kw) => haystack.includes(kw));
  if (matched) return null;

  return `None of the ${changes.length} changed file(s) mention keywords from the user request (${keywords.slice(0, 5).join(", ")}). The changes may not address the original task.`;
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

async function stageOnboard(ctx: Pick<PipelineContext, "emit" | "openai" | "github" | "cache" | "onboarding" | "warnings" | "detailParts" | "toolCalls">, prefetchedRepoInfo?: RepoInfo, prefetchedRepoTree?: string[]): Promise<{
  repoInfo: RepoInfo;
  repoKnowledge: RepoKnowledge;
  repoContext: string;
  repoTree: string[];
  knowledgeContext: string;
}> {
  const { emit, github, cache, onboarding, warnings, detailParts, toolCalls } = ctx;
  const p = CONFIG.progress.onboarding;

  emit("onboarding", "Learning repository structure, language, and conventions...", p.start);

  // Use pre-fetched data or fetch fresh
  const repoInfo = prefetchedRepoInfo ?? await github.getRepoInfo();
  const repoTree = prefetchedRepoTree ?? await github.getRepoTree(repoInfo.defaultBranch);

  // Run knowledge + repo context in parallel (both are independent)
  const [knowledgeResult, repoContextResult] = await Promise.all([
    // Onboard repo knowledge
    (async () => {
      try {
        return await onboarding.getKnowledge(repoInfo, repoTree);
      } catch (err) {
        logger.warn("Onboarding failed — using minimal defaults", { error: String(err) });
        warnings.push("Repo onboarding failed — using minimal defaults");
        return {
          repoFullName: repoInfo.fullName, language: "TypeScript",
          framework: "unknown", buildSystem: "npm", testFramework: "unknown",
          linter: "unknown", conventions: [] as string[], architecture: "unknown",
          keyFiles: {} as Record<string, string>, dependencies: [] as string[], linterRules: [] as string[], lastUpdated: new Date(),
        } as RepoKnowledge;
      }
    })(),
    // Get repo context
    (async () => {
      let repoContext = await cache.getRepoContext(repoInfo.fullName);
      if (!repoContext) {
        try {
          repoContext = await github.getRepoContext(repoInfo, repoTree);
          await cache.setRepoContext(repoInfo.fullName, repoContext);
        } catch (err) {
          logger.warn("Could not build full repo context", { error: String(err) });
          repoContext = `Repository: ${repoInfo.fullName}\nDefault branch: ${repoInfo.defaultBranch}`;
          warnings.push("Limited repo context — some API calls failed");
        }
      }
      return repoContext;
    })(),
  ]);

  const repoKnowledge = knowledgeResult;
  const repoContext = repoContextResult;

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

async function stageClone(ctx: Pick<PipelineContext, "emit" | "github" | "repoInfo" | "toolCalls">, titleForBranch: string): Promise<{
  branchName: string;
  dir: string;
  git: SimpleGit;
}> {
  const { emit, github, repoInfo, toolCalls } = ctx;
  const p = CONFIG.progress.cloning;

  emit("cloning", "Cloning repository and creating feature branch...", p.start);

  const branchName = makeBranchName({ type: "feat", title: titleForBranch.slice(0, 120) });
  const cloneResult = await github.cloneRepo(repoInfo.defaultBranch);
  const { dir, git } = cloneResult;
  await github.createBranch(git, branchName);

  // Install dependencies so tsc/eslint/prettier/build actually work
  emit("cloning", "Installing dependencies...", p.start + Math.round((p.end - p.start) * 0.5));
  try {
    const { execSync } = await import("child_process");
    const installCmd = await detectInstallCommand(dir);
    logger.info(`Installing deps in cloned repo: ${installCmd}`);
    execSync(installCmd, {
      cwd: dir,
      timeout: 180_000,
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf-8",
      stdio: "pipe",
      env: { ...process.env, CI: "true" },
    });
    logger.info("Dependencies installed successfully");
  } catch (installErr) {
    logger.warn("Dependency install failed — validation may be limited", {
      error: installErr instanceof Error ? installErr.message : String(installErr),
    });
  }

  toolCalls.push({
    tool: "clone_and_branch",
    arguments: { branch: branchName },
    result: { branch: branchName, dir },
  });

  emit("cloning", `Branch: ${branchName}`, p.end);
  return { branchName, dir, git };
}

/**
 * Detect the correct package install command based on lockfile presence.
 */
async function detectInstallCommand(dir: string): Promise<string> {
  const { access } = await import("fs/promises");
  const { join } = await import("path");

  try {
    await access(join(dir, "pnpm-lock.yaml"));
    return "pnpm install --frozen-lockfile 2>&1 || pnpm install 2>&1";
  } catch { /* not pnpm */ }

  try {
    await access(join(dir, "yarn.lock"));
    return "yarn install --frozen-lockfile 2>&1 || yarn install 2>&1";
  } catch { /* not yarn */ }

  try {
    await access(join(dir, "bun.lockb"));
    return "bun install --frozen-lockfile 2>&1 || bun install 2>&1";
  } catch { /* not bun */ }

  // Default to npm
  return "npm ci 2>&1 || npm install 2>&1";
}

async function stageCodeGeneration(ctx: Pick<PipelineContext, "emit" | "openai" | "github" | "gatherer" | "plan" | "repoKnowledge" | "repoContext" | "repoTree" | "knowledgeContext" | "existingScanContext" | "userMessage" | "warnings" | "toolCalls">): Promise<CodeGenerationResponse[]> {
  const { emit, openai, github, gatherer, plan, repoKnowledge, repoContext, repoTree, knowledgeContext, existingScanContext, userMessage, warnings, toolCalls } = ctx;
  const p = CONFIG.progress.coding;

  emit("coding", "Generating code with deep context analysis...", p.start);

  let allChanges: CodeGenerationResponse[] = [];
  const codeSteps = plan.steps.filter((s) => s.action !== "test" && s.action !== "review");
  const totalSteps = codeSteps.length;

  // Pre-fetch ALL step contexts + existing files in parallel
  emit("coding", "Pre-fetching context for all steps...", p.start);
  const prefetchedContexts = await Promise.all(
    codeSteps.map(async (step) => {
      const result: { fileContextStr: string; existingCode?: string } = { fileContextStr: "" };
      if (!step.targetFile) return result;

      const [ctxResult, fileResult] = await Promise.all([
        // Gather deep context
        (async () => {
          try {
            const fileCtx = await gatherer.gatherContext(step.targetFile!, repoTree, repoKnowledge);
            return gatherer.formatForPrompt(fileCtx);
          } catch (err) {
            logger.warn(`Could not gather deep context for ${step.targetFile}`, { error: String(err) });
            return "";
          }
        })(),
        // Read existing file
        (async () => {
          try {
            return await github.getFileContent(step.targetFile!);
          } catch {
            logger.debug(`File ${step.targetFile} not found in repo (new file)`);
            return undefined;
          }
        })(),
      ]);
      result.fileContextStr = ctxResult;
      result.existingCode = fileResult;
      return result;
    }),
  );

  for (let si = 0; si < codeSteps.length; si++) {
    const step = codeSteps[si];
    const stepProgress = p.start + Math.round((si / totalSteps) * (p.end - p.start));
    emit("coding", `Coding step ${si + 1}/${totalSteps}: ${step.description.slice(0, 60)}...`, stepProgress);

    // Use pre-fetched context and existing file
    const { fileContextStr, existingCode } = prefetchedContexts[si];

    const fullContext = [
      `## Original User Request\n${userMessage}`,
      `\n## Task Plan\n${plan.summary}`,
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
        task: `USER REQUEST: ${userMessage}\n\nCURRENT STEP: ${step.description}`,
        context: fullContext,
        existingCode, constraints: baseConstraints,
        userMessage,
      });

      // Immediate diff-check: retry once with escalated prompt if identical
      if (existingCode && isCodeIdentical(generated.code, existingCode)) {
        logger.warn(`Step ${si + 1}: identical output — retrying with escalation`);
        warnings.push(`Step ${si + 1} (${step.targetFile}): first generation was identical — regenerated`);

        generated = await openai.generateCode({
          task: `PREVIOUS ATTEMPT FAILED — you returned code IDENTICAL to the existing file.\n\nORIGINAL USER REQUEST: ${userMessage}\n\nCURRENT STEP: ${step.description}\n\nYou MUST make REAL, VISIBLE changes that implement the user's request above.`,
          context: fullContext, existingCode,
          constraints: [...baseConstraints, "YOUR PREVIOUS OUTPUT WAS IDENTICAL — produce DIFFERENT code that implements the user's request"],
          userMessage,
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

  // Meaningful-change verification (parallel)
  const existingFileContents = new Map<string, string>();
  const existingContentsArr = await Promise.all(
    allChanges.map(async (change) => {
      try {
        const content = await github.getFileContent(change.filename);
        return { filename: change.filename, content };
      } catch {
        return null; // New file — always meaningful
      }
    }),
  );
  for (const entry of existingContentsArr) {
    if (entry) existingFileContents.set(entry.filename, entry.content);
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

// Self-review removed in v4 — single-pass validation is faster and
// catches the same tsc/lint/prettier issues via real tools instead
// of an LLM guessing.

async function stageValidation(ctx: Pick<PipelineContext, "emit" | "github" | "validator" | "repoKnowledge" | "dir" | "git" | "warnings" | "detailParts" | "toolCalls">, allChanges: CodeGenerationResponse[]): Promise<{
  changes: CodeGenerationResponse[];
  validationPassed: boolean;
  stepResults: Record<string, boolean>;
}> {
  const { emit, github, validator, repoKnowledge, dir, git, warnings, detailParts, toolCalls } = ctx;

  emit("validating", "Applying code to disk...", CONFIG.progress.autoFix.start);
  let changes = [...allChanges];

  // ── Step 1: Apply generated code to disk ──
  const applyResult = await github.applyChanges(dir, git, changes);
  if (applyResult.skipped.length > 0) {
    warnings.push(`${applyResult.skipped.length} file(s) could not be applied: ${applyResult.skipped.map((s) => `${s.file} (${s.reason})`).join(", ")}`);
  }
  if (applyResult.applied.length === 0) {
    throw new Error("No files could be applied to disk.");
  }

  // ── Step 2: Auto-fix via real terminal tools (prettier --write, eslint --fix) ──
  emit("validating", "Running auto-fix: prettier --write, eslint --fix...", CONFIG.progress.autoFix.end);
  try {
    const autoFixes = await validator.autoFix(dir, repoKnowledge);
    if (autoFixes.length > 0) {
      logger.info(`Auto-fix applied: ${autoFixes.join(", ")}`);
      detailParts.push(`## Auto-Fix\nApplied: ${autoFixes.join(", ")}`);
      changes = await syncChangesFromDisk(changes, dir);
    }
  } catch (autoFixErr) {
    logger.warn("Auto-fix failed — continuing", { error: String(autoFixErr) });
  }

  // ── Step 3: Validate via real terminal tools (tsc, eslint, build, test) ──
  // No LLM involvement — just run the project's actual scripts and report results.
  emit("validating", "Running validation: tsc, eslint, build, tests...", CONFIG.progress.validation.start);

  let validationPassed = false;
  const stepResults: Record<string, boolean> = {};

  try {
    const validation = await validator.validate(dir, repoKnowledge, { skipInstall: true, skipBuild: true });

    for (const step of validation.steps) {
      if (!step.skipped) stepResults[step.name] = step.passed;
    }
    toolCalls.push({
      tool: "tool_validation",
      arguments: {},
      result: { passed: validation.passed, summary: validation.summary },
    });

    if (validation.passed) {
      validationPassed = true;
      detailParts.push(`## Validation\nAll checks passed: ${validation.summary}`);
    } else {
      const failedSteps = validation.steps.filter((s) => !s.passed && !s.skipped);
      const failedNames = failedSteps.map((s) => s.name).join(", ");
      logger.warn(`Validation failed: ${failedNames}`);
      detailParts.push(
        `## Validation\nFailed checks: ${failedNames}\n${failedSteps.map((s) => `### ${s.name}\n\`\`\`\n${s.output.slice(0, 2000)}\n\`\`\``).join("\n\n")}`,
      );
    }
  } catch (valErr) {
    logger.warn("Validation crashed", { error: String(valErr) });
    warnings.push(`Validation failed: ${valErr instanceof Error ? valErr.message : String(valErr)}`);
    detailParts.push("## Validation\nSkipped — validation pipeline crashed");
  }

  return { changes, validationPassed, stepResults };
}

// Task completion check removed in v4 — was producing false negatives
// (e.g. flagging valid redesigns as "only export/Tailwind changes").
// QA agent handles real verification in a later phase instead.

async function stagePushAndPR(ctx: Pick<PipelineContext, "emit" | "openai" | "github" | "cache" | "repoInfo" | "issue" | "plan" | "branchName" | "dir" | "git" | "validationPassed" | "stepResults" | "isDraft" | "warnings" | "detailParts" | "toolCalls">, allChanges: CodeGenerationResponse[], preGeneratedTitleInfo?: { title: string; type: string; scope: string }): Promise<{
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

  // Commit & push — use pre-generated title if available, otherwise generate
  emit("pushing", "Committing and pushing...", CONFIG.progress.pushing.start + 3);
  let titleInfo: { title: string; type: string; scope: string };
  if (preGeneratedTitleInfo) {
    titleInfo = preGeneratedTitleInfo;
  } else {
    try {
      titleInfo = await openai.generateCommitTitle(
        `${issue.title}\n\n${issue.body}`,
        allChanges.map((c) => ({ filename: c.filename, explanation: c.explanation })),
      );
    } catch {
      titleInfo = { title: `feat: ${issue.title.slice(0, CONFIG.contextLimits.commitTitleLength).toLowerCase()}`, type: "feat", scope: "frontend" };
      warnings.push("Commit title generation failed — using fallback");
    }
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
- ✅ Validated via terminal (tsc, eslint, build, tests)
- ✅ Rebased onto latest \`main\` before push
${warningsSection}
${plan.risks.length ? `### Risks\n${plan.risks.map((r: string) => `- ${r}`).join("\n")}` : ""}

---
*Generated by AI Engineer Agent v3${!validationPassed ? " — ⚠️ DRAFT: some checks did not pass, manual review required" : ""}*`;
}

/** API-only pipeline when git is not available (e.g. serverless). Uses code-store + createGitHubPullRequest like QA. */
async function runFrontendDeveloperApiOnly(opts: {
  userMessage: string;
  emit: ProgressCallback;
  openai: OpenAIService;
  github: GitHubService;
  cache: CacheService;
  onboardingSvc: OnboardingService;
  gatherer: ContextGathererService;
  warnings: string[];
  detailParts: string[];
  toolCalls: AgentResponse["toolCalls"];
}): Promise<AgentResponse> {
  const { userMessage, emit, openai, github, cache, onboardingSvc, gatherer, warnings, detailParts, toolCalls } = opts;

  try {
    emit("onboarding", "Learning repository structure (API-only mode)...", 5);
    const { repoInfo, repoKnowledge, repoContext, repoTree, knowledgeContext } =
      await stageOnboard({ emit, openai, github, cache, onboarding: onboardingSvc, warnings, detailParts, toolCalls });

    emit("planning", "Planning implementation...", 15);
    const { issue, plan, existingScanContext, enrichedContext } =
      await stagePlan({ emit, openai, github, userMessage, repoTree, repoContext, knowledgeContext, warnings, detailParts, toolCalls });

    const branchName = makeBranchName({ type: "feat", title: issue.title });
    emit("coding", "Generating code (API-only, no local git)...", 35);
    const allChanges = await stageCodeGeneration({
      emit, openai, github, gatherer, plan, repoKnowledge, repoContext, repoTree,
      knowledgeContext, existingScanContext, userMessage, warnings, toolCalls,
    });

    for (const change of allChanges) {
      writeCode(
        {
          file_path: change.filename,
          language: languageFromFilename(change.filename),
          code: change.code,
          description: change.explanation,
        },
        "frontend_developer",
      );
    }

    const prTitle = `feat: ${issue.title.slice(0, CONFIG.contextLimits.commitTitleLength)}`;
    const prBody = buildPRBody(issue, plan, allChanges, false, warnings, {});

    emit("pushing", "Creating pull request via GitHub API...", 94);
    const prResult = await createGitHubPullRequest({
      title: prTitle,
      body: prBody,
      head: branchName,
      base: repoInfo.defaultBranch,
      created_by: "frontend_developer",
    });

    const prNumber = "error" in prResult ? undefined : prResult.prNumber;
    const prUrl = "error" in prResult ? undefined : prResult.url;
    const simulated = "simulated" in prResult && prResult.simulated;

    if ("error" in prResult && prResult.error) {
      warnings.push(`PR creation failed: ${prResult.error}`);
      detailParts.push(`## Pull Request\n**API-only PR failed:** ${prResult.error}`);
    } else if (simulated) {
      detailParts.push(`## Pull Request\nSimulated (GitHub not configured or error). Branch: \`${branchName}\`.`);
    } else if (prNumber != null && prUrl) {
      toolCalls.push({
        tool: "create_pull_request",
        arguments: { title: prTitle, branch: branchName },
        result: { prNumber, prUrl },
      });
      detailParts.push(`## Pull Request\n[PR #${prNumber}](${prUrl}): ${prTitle}`);
    }
    detailParts.push(`## Files Changed\n${allChanges.map((c) => `- \`${c.filename}\`: ${c.explanation}`).join("\n")}`);

    const titleInfo = { title: prTitle, type: "feat", scope: "frontend" };
    return {
      agent: "frontend_developer",
      summary: buildStructuredSummary({
        title: titleInfo.title,
        filesChanged: allChanges.length,
        validationPassed: false,
        branchName,
        prNumber,
        prUrl,
        isDraft: true,
        warnings: [...warnings, ...(simulated ? ["PR was simulated (no GitHub or API error)."] : [])],
      }),
      prUrl,
      toolCalls,
      detail: detailParts.join("\n\n"),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Frontend developer API-only pipeline failed", { error: msg });
    return {
      agent: "frontend_developer",
      summary: buildStructuredSummary({ pipelineError: msg, warnings }),
      toolCalls,
      detail: [...detailParts, `## Error\n${msg}`, ...(warnings.length > 0 ? [`## Warnings\n${warnings.map((w) => `- ${w}`).join("\n")}`] : [])].join("\n\n"),
    };
  }
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

  if (!isGitAvailable()) {
    return runFrontendDeveloperApiOnly({
      userMessage,
      emit,
      openai,
      github,
      cache,
      onboardingSvc,
      gatherer,
      warnings,
      detailParts,
      toolCalls,
    });
  }

  try {
    // Stage 0: Fetch repoInfo + repoTree ONCE at the top
    const repoInfo = await github.getRepoInfo();
    let repoTree: string[] = [];
    try {
      repoTree = await github.getRepoTree(repoInfo.defaultBranch);
    } catch (err) {
      logger.warn("Could not fetch repo tree", { error: String(err) });
      warnings.push("Repo tree unavailable — context gathering will be limited");
    }

    // Stage 1: Start clone in background (don't await yet — only needed before validation)
    const clonePromise = stageClone({ emit, github, repoInfo, toolCalls }, userMessage);

    // Stage 2: Onboard (pass pre-fetched repoInfo + repoTree)
    const { repoKnowledge, repoContext, knowledgeContext } =
      await stageOnboard({ emit, openai, github, cache, onboarding: onboardingSvc, warnings, detailParts, toolCalls }, repoInfo, repoTree);

    // Stage 3: Plan
    const { issue, plan, existingScanContext } =
      await stagePlan({ emit, openai, github, userMessage, repoTree, repoContext, knowledgeContext, warnings, detailParts, toolCalls });

    // Stage 4: Generate code (uses GitHub API, not local disk — clone not needed yet)
    let allChanges =
      await stageCodeGeneration({ emit, openai, github, gatherer, plan, repoKnowledge, repoContext, repoTree, knowledgeContext, existingScanContext, userMessage, warnings, toolCalls });

    // Stage 5: NOW await clone (should be done by now since it ran in background)
    const { branchName, dir, git } = await clonePromise;

    // Stage 6: Run validation + generate commit title in parallel
    const [validationResult, titleInfo] = await Promise.all([
      stageValidation({ emit, github, validator, repoKnowledge, dir, git, warnings, detailParts, toolCalls }, allChanges),
      (async () => {
        try {
          return await openai.generateCommitTitle(
            `${issue.title}\n\n${issue.body}`,
            allChanges.map((c) => ({ filename: c.filename, explanation: c.explanation })),
          );
        } catch {
          warnings.push("Commit title generation failed — using fallback");
          return { title: `feat: ${issue.title.slice(0, CONFIG.contextLimits.commitTitleLength).toLowerCase()}`, type: "feat", scope: "frontend" };
        }
      })(),
    ]);

    const { changes: validatedChanges, validationPassed, stepResults } = validationResult;
    allChanges = validatedChanges;

    // Task-relevance check (non-LLM, non-blocking)
    const relevanceIssue = quickTaskRelevanceCheck(userMessage, allChanges);
    if (relevanceIssue) {
      warnings.push(`Task relevance concern: ${relevanceIssue}`);
    }

    // Draft decision
    const isDraft = !validationPassed || relevanceIssue !== null;
    if (isDraft) {
      const failedChecks = Object.entries(stepResults).filter(([, passed]) => !passed).map(([name]) => name).join(", ");
      logger.warn(`Validation failed (${failedChecks}) — will create DRAFT PR`);
      detailParts.push(`## ⚠️ Draft PR\nFailed checks: ${failedChecks}\nOpening as DRAFT.`);
      warnings.push(`DRAFT PR: ${failedChecks} failed after fix attempt.`);
    }

    // Stage 7: Push & create PR (pass pre-generated titleInfo)
    const { prNumber, prUrl } =
      await stagePushAndPR({ emit, openai, github, cache, repoInfo, issue, plan, branchName, dir, git, validationPassed, stepResults, isDraft, warnings, detailParts, toolCalls }, allChanges, titleInfo);

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
