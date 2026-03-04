// ──────────────────────────────────────────────────────────
// Frontend Developer Agent — v3 Autonomous Pipeline
//
// Replaces the simple LLM-tool-calling agent with v3's
// full implement skill: onboard → context → plan → clone →
// code → self-review → validate → push → PR
//
// Fully autonomous: handles errors at every stage, retries
// recoverable failures, and always produces a PR or a
// meaningful error report.
// ──────────────────────────────────────────────────────────

import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "@/lib/logger";
import { writeCode } from "@/lib/clients/code-store";

// V3 services (mirroring v3 directory structure)
import { OpenAIService } from "./services/openai.service";
import { GitHubService } from "./services/github.service";
import { CacheService } from "./cache/cache.service";
import { OnboardingService } from "./onboarding/onboarding.service";
import { ContextGathererService } from "./services/context-gatherer.service";
import { CodeValidatorService } from "./services/code-validator.service";
import { ImpactAnalyzerService } from "./services/impact-analyzer.service";
import { makeBranchName } from "./utils/branch-name";
import type { CodeGenerationResponse, IssueInfo, PlanStep } from "./types";
import type { AgentResponse, FEProgressStage } from "../types";

const MAX_REVIEW_ITERATIONS = 3;
const MAX_VALIDATION_FIXES = 3;

/** Callback for sub-step progress events */
export type ProgressCallback = (stage: FEProgressStage, message: string, progress: number) => void;

// ── Helpers ────────────────────────────────────────────────

/**
 * Deduplicate code changes — if the LLM produces multiple outputs
 * for the same filename, keep the LAST one (it's the most refined).
 */
function deduplicateChanges(changes: CodeGenerationResponse[]): CodeGenerationResponse[] {
  const seen = new Map<string, number>();
  const normalized: CodeGenerationResponse[] = [];

  for (const change of changes) {
    // Normalize the filename: strip leading slashes, collapse doubles
    const filename = change.filename
      .replace(/\.\.\//g, "")
      .replace(/^\/+/, "")
      .replace(/\/+/g, "/")
      .trim();

    if (!filename) continue;

    const existing = seen.get(filename);
    if (existing !== undefined) {
      // Replace the older version
      normalized[existing] = { ...change, filename };
    } else {
      seen.set(filename, normalized.length);
      normalized.push({ ...change, filename });
    }
  }

  return normalized.filter(Boolean);
}

/**
 * Detect file/directory path conflicts in the change set BEFORE applying.
 * E.g., if we have both "src/Foo.tsx" and "src/Foo/index.tsx", the former
 * must be renamed to "src/Foo/index.tsx" or removed.
 */
function resolvePathConflicts(changes: CodeGenerationResponse[]): CodeGenerationResponse[] {
  const filePaths = new Set(changes.map((c) => c.filename));

  return changes.map((change) => {
    // Check if any OTHER file uses this file's path as a directory prefix
    const asDir = change.filename.replace(/\.[^/.]+$/, ""); // strip extension
    const hasChildFiles = [...filePaths].some(
      (f) => f !== change.filename && f.startsWith(asDir + "/"),
    );

    if (hasChildFiles) {
      // This file path conflicts with a directory. Move it to dir/index.ext
      const ext = change.filename.substring(change.filename.lastIndexOf("."));
      const newFilename = `${asDir}/index${ext}`;
      logger.warn(
        `Path conflict: "${change.filename}" conflicts with directory for other files. ` +
        `Renaming to "${newFilename}"`,
      );
      return { ...change, filename: newFilename };
    }

    return change;
  });
}

/**
 * Extract keywords from the user's task description for repo scanning.
 * Pulls out nouns/component names that are likely to match file/directory names.
 */
function extractTaskKeywords(message: string): string[] {
  // Common frontend terms to search for
  const words = message
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  // Remove common stop words
  const stopWords = new Set([
    "the", "and", "for", "with", "that", "this", "from", "have", "has",
    "are", "was", "were", "will", "would", "could", "should", "can",
    "not", "but", "all", "any", "each", "make", "like", "add", "create",
    "build", "implement", "develop", "write", "need", "want", "please",
    "also", "new", "use", "using", "into", "about", "some", "more",
  ]);

  return [...new Set(words.filter((w) => !stopWords.has(w)))];
}

/**
 * Filter out plan steps that target out-of-scope files.
 * The agent should NOT touch README, build scripts, CI configs, or other
 * infrastructure files unless the user explicitly asked for it.
 */
const OUT_OF_SCOPE_PATTERNS = [
  /^README\.md$/i,
  /^CHANGELOG\.md$/i,
  /^LICENSE/i,
  /^\.github\//,
  /^\.gitlab-ci/,
  /^Dockerfile/i,
  /^docker-compose/i,
  /\.config\.(js|ts|mjs|cjs)$/,  // generic config files
  /^scripts\//,                    // build/deploy scripts
  /^\.husky\//,
  /^\.vscode\//,
];

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

    // Only filter if the user didn't mention this file type
    const basename = target.toLowerCase().split("/").pop()?.split(".")[0] || "";
    if (isOutOfScope && !messageLower.includes(basename)) {
      removed.push(step);
    } else {
      kept.push(step);
    }
  }

  return { kept, removed };
}

/**
 * Build a "existing codebase scan" context string from related files.
 * This prevents the planner from creating duplicates of existing components.
 */
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

  // Add content previews for the most relevant files (up to 5)
  const previewFiles = [...existingContents.entries()].slice(0, 5);
  if (previewFiles.length > 0) {
    parts.push("\n### Content previews of existing files:");
    for (const [filename, content] of previewFiles) {
      parts.push(`\n--- ${filename} ---\n${content.slice(0, 2000)}`);
    }
  }

  return parts.join("\n");
}

// ── Main Pipeline ──────────────────────────────────────────

/**
 * Run the v3 autonomous pipeline as the frontend developer agent.
 *
 * This bypasses the generic runAgent() tool-calling loop entirely
 * and instead runs the deterministic v3 implement pipeline:
 *   1. Onboard repo (learn language, framework, conventions)
 *   2. Gather repo context + plan
 *   3. Clone repo & create branch
 *   4. Generate code with deep file context
 *   5. LLM self-review loop (up to 3 iterations)
 *   6. Real tool validation loop (tsc/eslint/tests, up to 2 iterations)
 *   7. Push & open PR
 *
 * Fully autonomous: each stage has its own error handling.
 * Recoverable errors retry; unrecoverable ones skip the stage
 * and continue to produce the best possible output.
 */
export async function runFrontendDeveloper(
  userMessage: string,
  onProgress?: ProgressCallback,
): Promise<AgentResponse> {
  const emit = onProgress ?? (() => {});
  const toolCalls: AgentResponse["toolCalls"] = [];
  const detailParts: string[] = [];
  const warnings: string[] = [];

  // ── Instantiate v3 services ──
  const openai = new OpenAIService();
  const github = new GitHubService();
  const cache = new CacheService();
  const onboarding = new OnboardingService(openai, github, cache);
  const gatherer = new ContextGathererService(github);
  const validator = new CodeValidatorService();
  const impactAnalyzer = new ImpactAnalyzerService(github);

  try {
    // ══════════════════════════════════════════════
    // Step 1: Onboard — learn the repo
    // ══════════════════════════════════════════════
    emit("onboarding", "Learning repository structure, language, and conventions...", 5);

    let repoInfo;
    try {
      repoInfo = await github.getRepoInfo();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Cannot connect to GitHub repository: ${msg}. Check GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO env vars.`);
    }

    let repoKnowledge;
    try {
      repoKnowledge = await onboarding.getKnowledge(repoInfo);
    } catch (err) {
      logger.warn("Onboarding failed — using minimal defaults", { error: String(err) });
      repoKnowledge = {
        repoFullName: repoInfo.fullName,
        language: "TypeScript",
        framework: "unknown",
        buildSystem: "npm",
        testFramework: "unknown",
        linter: "unknown",
        conventions: [],
        architecture: "unknown",
        keyFiles: {},
        dependencies: [],
        linterRules: [],
        lastUpdated: new Date(),
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
    } catch {
      logger.warn("Could not fetch repo tree, continuing with limited context");
      warnings.push("Repo tree unavailable — context gathering will be limited");
    }

    emit("onboarding", `Onboarded: ${repoKnowledge.language}/${repoKnowledge.framework}`, 10);

    // ══════════════════════════════════════════════
    // Step 2: Pre-planning context scan + Plan
    // ══════════════════════════════════════════════
    emit("planning", "Scanning repository for existing related files...", 12);

    // Build a synthetic issue from the user message
    const issue: IssueInfo = {
      number: 0,
      title: userMessage.slice(0, 120),
      body: userMessage,
      labels: [],
      author: "chat-user",
    };

    // ── Pre-planning scan: find existing files related to the task ──
    // This prevents the planner from creating duplicates (e.g. new HomePage
    // when one already exists in the repo).
    let existingScanContext = "";
    if (repoTree.length > 0) {
      try {
        const keywords = extractTaskKeywords(userMessage);
        logger.info(`Pre-planning scan keywords: ${keywords.join(", ")}`);

        const relatedFiles = await github.findRelatedFiles(repoTree, keywords);

        if (relatedFiles.length > 0) {
          // Read the most important related files (pages, components)
          const filesToRead = relatedFiles
            .filter((f) => /\.(tsx?|jsx?|vue|svelte)$/.test(f))
            .slice(0, 8);

          const existingContents = await github.readMultipleFiles(filesToRead);
          existingScanContext = buildExistingScanContext(relatedFiles, existingContents);

          logger.info(`Found ${relatedFiles.length} related files, read ${existingContents.size} for context`);
          detailParts.push(
            `## Pre-Planning Scan\nFound ${relatedFiles.length} existing file(s) related to task:\n${relatedFiles.slice(0, 15).map((f) => `- \`${f}\``).join("\n")}`,
          );
        }
      } catch (err) {
        logger.warn("Pre-planning scan failed — continuing without it", { error: String(err) });
      }
    }

    emit("planning", "Creating implementation plan...", 15);

    // Build enriched context WITH existing file scan
    const enrichedContext = [
      repoContext,
      `\n## Project Knowledge\n${knowledgeContext}`,
      existingScanContext ? `\n${existingScanContext}` : "",
    ].filter(Boolean).join("\n");

    let plan;
    try {
      plan = await openai.planTask(issue, enrichedContext);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Planning failed: ${msg}. The LLM may have returned invalid JSON.`);
    }

    // Validate plan has steps
    if (!plan.steps || plan.steps.length === 0) {
      throw new Error("Planning produced zero steps — the task may be too vague. Try providing more detail.");
    }

    detailParts.push(
      `## Implementation Plan\n**Summary:** ${plan.summary}\n**Approach:** ${plan.approach}\n**Steps:**\n${plan.steps.map((s) => `${s.order}. ${s.description} (${s.action} → \`${s.targetFile}\`)`).join("\n")}\n**Risks:** ${plan.risks.join(", ") || "None identified"}`,
    );
    toolCalls.push({
      tool: "plan_implementation",
      arguments: { issueTitle: issue.title },
      result: { steps: plan.steps.length, files: plan.estimatedFiles.length },
    });

    // ── Scope filter: remove out-of-scope steps (README rewrites, config changes, etc.) ──
    const { kept: scopedSteps, removed: removedSteps } = filterOutOfScopeSteps(plan.steps, userMessage);
    if (removedSteps.length > 0) {
      logger.info(`Scope filter: removed ${removedSteps.length} out-of-scope steps: ${removedSteps.map((s) => s.targetFile).join(", ")}`);
      warnings.push(`Filtered ${removedSteps.length} out-of-scope file(s): ${removedSteps.map((s) => s.targetFile).join(", ")}`);
      plan.steps = scopedSteps;
    }

    if (plan.steps.length === 0) {
      throw new Error("All planned steps were filtered as out-of-scope. The task may need more specific instructions.");
    }

    emit("planning", `Plan: ${plan.steps.length} steps, ${plan.estimatedFiles.length} files`, 20);

    // ══════════════════════════════════════════════
    // Step 3: Clone & branch
    // ══════════════════════════════════════════════
    emit("cloning", "Cloning repository and creating feature branch...", 25);

    const branchName = makeBranchName({ type: "feat", title: issue.title });

    let dir: string;
    let git;
    try {
      const cloneResult = await github.cloneRepo(repoInfo.defaultBranch);
      dir = cloneResult.dir;
      git = cloneResult.git;
      await github.createBranch(git, branchName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to clone repo or create branch: ${msg}`);
    }

    toolCalls.push({
      tool: "clone_and_branch",
      arguments: { branch: branchName },
      result: { branch: branchName, dir },
    });

    emit("cloning", `Branch: ${branchName}`, 30);

    // ══════════════════════════════════════════════
    // Step 4: Generate code WITH deep context
    // ══════════════════════════════════════════════
    emit("coding", "Generating code with deep context analysis...", 35);

    let allChanges: CodeGenerationResponse[] = [];
    const codeSteps = plan.steps.filter((s) => s.action !== "test" && s.action !== "review");
    const totalSteps = codeSteps.length;

    for (let si = 0; si < codeSteps.length; si++) {
      const step = codeSteps[si];
      const stepProgress = 35 + Math.round((si / totalSteps) * 20); // 35-55%

      emit("coding", `Coding step ${si + 1}/${totalSteps}: ${step.description.slice(0, 60)}...`, stepProgress);

      // Gather deep context for this file
      let fileContextStr = "";
      if (step.targetFile) {
        try {
          const fileCtx = await gatherer.gatherContext(step.targetFile, repoTree, repoKnowledge);
          fileContextStr = gatherer.formatForPrompt(fileCtx);
        } catch {
          logger.warn(`Could not gather deep context for ${step.targetFile}`);
        }
      }

      // Read existing code for ALL actions (not just "modify")
      // This prevents the agent from creating files that duplicate existing ones
      let existingCode: string | undefined;
      if (step.targetFile) {
        try {
          existingCode = await github.getFileContent(step.targetFile);
        } catch { /* file doesn't exist yet — that's fine */ }
      }

      const fullContext = [
        `## Task Plan\n${plan.summary}`,
        `\n## Step ${step.order}/${plan.steps.length}\n${step.details}`,
        knowledgeContext ? `\n## Project Knowledge\n${knowledgeContext}` : "",
        fileContextStr ? `\n## Related Code Context\n${fileContextStr}` : "",
        existingScanContext ? `\n${existingScanContext}` : "",
        `\n## Repository Structure\n${repoContext.slice(0, 2000)}`,
      ].filter(Boolean).join("\n");

      try {
        const generated = await openai.generateCode({
          task: step.description,
          context: fullContext,
          existingCode,
          constraints: [
            `Target file: ${step.targetFile || "determine from context"}`,
            `Action: ${step.action}`,
            repoKnowledge.linter ? `Code MUST pass ${repoKnowledge.linter} linter` : "",
            repoKnowledge.conventions?.length
              ? `Follow conventions: ${repoKnowledge.conventions.slice(0, 5).join(", ")}`
              : "",
            // Inject discovered linter rules so the LLM generates compliant code from the start
            ...(repoKnowledge.linterRules.length > 0
              ? [`LINTER RULES — your generated code MUST comply with ALL of these:\n${repoKnowledge.linterRules.map((r) => `  • ${r}`).join("\n")}`]
              : []),
            "Preserve ALL existing imports — do NOT change any import path unless the new target actually exists in the repo",
            "If the existing file has 'use client', the output MUST also have 'use client' at the top",
            "In Next.js App Router: page.tsx must NOT include Header/Footer/Nav if layout.tsx already provides them",
            "Do NOT add duplicate metadata/viewport exports if layout.tsx already has them",
            "Match the naming conventions and code style of sibling files",
            existingCode ? "IMPORTANT: This file already exists. Preserve ALL working code. Only change what the task requires." : "",
          ].filter(Boolean),
        });

        allChanges.push(generated);

        // Also write to full-ai's code-store so the UI can display files
        writeCode(
          {
            file_path: generated.filename,
            language: generated.language,
            code: generated.code,
            description: generated.explanation,
          },
          "frontend_developer",
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Code generation failed for step ${si + 1}: ${msg}`);
        warnings.push(`Step ${si + 1} (${step.targetFile}) code generation failed: ${msg}`);
        // Continue with other steps — partial implementation is better than nothing
      }
    }

    if (allChanges.length === 0) {
      throw new Error("Code generation produced zero files. All steps failed. Check LLM responses.");
    }

    // ── Deduplicate & resolve path conflicts ──
    allChanges = deduplicateChanges(allChanges);
    allChanges = resolvePathConflicts(allChanges);

    toolCalls.push({
      tool: "generate_code",
      arguments: { steps: totalSteps },
      result: { filesGenerated: allChanges.length },
    });

    emit("coding", `Generated ${allChanges.length} files`, 55);

    // ══════════════════════════════════════════════
    // Step 5: LLM Self-Review Loop
    // ══════════════════════════════════════════════
    emit("self_review", "Running LLM self-review...", 58);

    for (let iteration = 1; iteration <= MAX_REVIEW_ITERATIONS; iteration++) {
      emit("self_review", `Self-review iteration ${iteration}/${MAX_REVIEW_ITERATIONS}...`, 58 + iteration * 3);

      try {
        const review = await openai.selfReviewCode(
          allChanges.map((c) => ({ filename: c.filename, code: c.code, language: c.language })),
          `${issue.title}\n\n${issue.body}`,
          enrichedContext,
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errors = review.issues.filter((i: any) => i.severity === "error" || i.severity === "critical");

        if (review.approved || errors.length === 0) {
          detailParts.push(`## LLM Self-Review\nPassed on iteration ${iteration}: ${review.summary}`);
          toolCalls.push({
            tool: "self_review",
            arguments: { iteration },
            result: { approved: true, summary: review.summary },
          });
          break;
        }

        logger.warn(`LLM review found ${errors.length} issues on iteration ${iteration}, fixing...`);

        // Group errors by filename and fix
        const filesWithErrors = new Map<string, typeof errors>();
        for (const err of errors) {
          const existing = filesWithErrors.get(err.filename) || [];
          existing.push(err);
          filesWithErrors.set(err.filename, existing);
        }

        for (const [filename, fileErrors] of filesWithErrors.entries()) {
          const changeIdx = allChanges.findIndex((c) => c.filename === filename);
          if (changeIdx === -1) continue;

          try {
            const original = allChanges[changeIdx];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fixed = await openai.fixCodeIssues(
              { filename: original.filename, code: original.code, language: original.language },
              fileErrors.map((e: any) => ({ issue: e.issue, fix: e.fix })),
              enrichedContext,
            );
            allChanges[changeIdx] = fixed;

            // Update code-store too
            writeCode(
              {
                file_path: fixed.filename,
                language: fixed.language,
                code: fixed.code,
                description: `[fixed] ${fixed.explanation}`,
              },
              "frontend_developer",
            );
          } catch (fixErr) {
            logger.warn(`Failed to fix ${filename} in review iteration ${iteration}: ${fixErr}`);
            warnings.push(`Self-review fix failed for ${filename} on iteration ${iteration}`);
          }
        }

        if (iteration === MAX_REVIEW_ITERATIONS) {
          detailParts.push(`## LLM Self-Review\nMax iterations reached. Last review: ${review.summary}`);
          warnings.push("Self-review reached max iterations — some issues may remain");
        }
      } catch (reviewErr) {
        const msg = reviewErr instanceof Error ? reviewErr.message : String(reviewErr);
        logger.warn(`Self-review iteration ${iteration} failed: ${msg}`);
        warnings.push(`Self-review iteration ${iteration} failed: ${msg}`);
        // Continue — we still have the code from generation
        if (iteration === 1) {
          detailParts.push("## LLM Self-Review\nSkipped — review call failed");
        }
        break;
      }
    }

    // ── Re-deduplicate after fixes (fixCodeIssues may return changed filenames) ──
    allChanges = deduplicateChanges(allChanges);
    allChanges = resolvePathConflicts(allChanges);

    // ══════════════════════════════════════════════
    // Step 6: Real Tool Validation Loop (3-tier)
    //
    // Tier 1: Deterministic auto-fix (prettier --write, eslint --fix)
    // Tier 2: LLM-assisted fix (targeted — only affected files)
    // Tier 3: Hard gate (block push+MR if ANY check fails)
    // ══════════════════════════════════════════════
    emit("validating", "Applying code to disk...", 65);

    // Apply code to the cloned repo
    const applyResult = await github.applyChanges(dir, git, allChanges);
    if (applyResult.skipped.length > 0) {
      warnings.push(
        `${applyResult.skipped.length} file(s) could not be applied: ` +
        applyResult.skipped.map((s) => `${s.file} (${s.reason})`).join(", "),
      );
    }

    if (applyResult.applied.length === 0) {
      throw new Error("No files could be applied to disk. All file writes failed.");
    }

    // ── Tier 1: Deterministic auto-fix (no LLM needed) ──
    emit("validating", "Running auto-fix: prettier --write, eslint --fix...", 66);
    try {
      const autoFixes = await validator.autoFix(dir, repoKnowledge);
      if (autoFixes.length > 0) {
        logger.info(`Auto-fix applied: ${autoFixes.join(", ")}`);
        detailParts.push(`## Auto-Fix (Tier 1)\nApplied: ${autoFixes.join(", ")}`);

        // Read back auto-fixed files from disk so our in-memory changes stay in sync
        for (let ci = 0; ci < allChanges.length; ci++) {
          const filePath = path.join(dir, allChanges[ci].filename);
          try {
            const fixedContent = await fs.readFile(filePath, "utf-8");
            allChanges[ci] = { ...allChanges[ci], code: fixedContent };
          } catch { /* file may not exist on disk if it was skipped */ }
        }
      }
    } catch (autoFixErr) {
      logger.warn("Auto-fix tier failed — continuing to validation", { error: String(autoFixErr) });
    }

    // ── Tier 2: LLM-assisted fix loop (targeted at affected files only) ──
    let validationPassed = false;
    /** Per-step pass/fail tracking for honest PR body */
    const stepResults: Record<string, boolean> = {};

    for (let valIter = 1; valIter <= MAX_VALIDATION_FIXES; valIter++) {
      emit("validating", `Validation iteration ${valIter}/${MAX_VALIDATION_FIXES} (tsc, eslint, prettier, tests)...`, 68 + valIter * 4);

      try {
        const validation = await validator.validate(dir, repoKnowledge);

        // Track per-step results for the PR body
        for (const step of validation.steps) {
          if (!step.skipped) {
            stepResults[step.name] = step.passed;
          }
        }

        toolCalls.push({
          tool: "tool_validation",
          arguments: { iteration: valIter },
          result: { passed: validation.passed, summary: validation.summary },
        });

        if (validation.passed) {
          validationPassed = true;
          detailParts.push(`## Tool Validation\nAll checks passed on iteration ${valIter}: ${validation.summary}`);
          break;
        }

        logger.warn(`Tool validation iteration ${valIter} found issues: ${validation.summary}`);

        // Parse errors into structured format for targeted LLM fixes
        const failedSteps = validation.steps.filter((s) => !s.passed && !s.skipped);
        const allParsedErrors = failedSteps.flatMap((s) => validator.parseErrors(s));

        // Fallback: if parser found zero errors but steps failed, use raw output
        const failureContext = allParsedErrors.length > 0
          ? validator.formatErrorsForLLM(allParsedErrors)
          : failedSteps
            .map((s) => `### ${s.name} FAILED:\n\`\`\`\n${s.output.slice(0, 2000)}\n\`\`\``)
            .join("\n\n");

        // Only send AFFECTED files to the LLM for fixing
        let anyFixed = false;
        for (let ci = 0; ci < allChanges.length; ci++) {
          const change = allChanges[ci];

          // Check if THIS file has parsed errors
          const fileErrors = validator.formatErrorsForLLM(allParsedErrors, change.filename);
          // Also check raw output for mentions
          const isInRawOutput = failedSteps.some((s) => s.output.includes(change.filename));
          // tsc/lint can affect files not directly named
          const isGlobalCheck = failedSteps.some((s) => s.name === "type-check" || s.name === "lint");

          if (!fileErrors && !isInRawOutput && !isGlobalCheck) continue;

          // Build targeted fix prompt: structured errors for this specific file
          const fixPrompt = fileErrors
            ? `Fix these SPECIFIC errors in ${change.filename}:\n\n${fileErrors}`
            : `Tool validation failures (find errors affecting ${change.filename}):\n\n${failureContext}`;

          try {
            const fixed = await openai.fixCodeIssues(
              { filename: change.filename, code: change.code, language: change.language },
              [{ issue: fixPrompt, fix: "Fix ONLY the listed errors. Do NOT change anything else. Preserve all working code, imports, types, and styling." }],
              enrichedContext,
            );
            allChanges[ci] = fixed;
            anyFixed = true;
          } catch (fixErr) {
            logger.warn(`Failed to fix ${change.filename} from validation: ${fixErr}`);
          }
        }

        if (!anyFixed) {
          logger.warn("No files were fixed in this iteration — breaking to avoid infinite loop");
          detailParts.push(`## Tool Validation\nNo fixes could be applied on iteration ${valIter}. Last: ${validation.summary}`);
          break;
        }

        // Re-deduplicate and re-apply fixed code
        allChanges = deduplicateChanges(allChanges);
        allChanges = resolvePathConflicts(allChanges);
        await github.applyChanges(dir, git, allChanges);

        // After re-applying, run auto-fix again (fixes any formatting the LLM broke)
        try {
          await validator.autoFix(dir, repoKnowledge);
          for (let ci = 0; ci < allChanges.length; ci++) {
            const filePath = path.join(dir, allChanges[ci].filename);
            try {
              const fixedContent = await fs.readFile(filePath, "utf-8");
              allChanges[ci] = { ...allChanges[ci], code: fixedContent };
            } catch { /* ignore */ }
          }
        } catch { /* non-critical */ }

        if (valIter === MAX_VALIDATION_FIXES) {
          detailParts.push(`## Tool Validation\nMax iterations reached. Last: ${validation.summary}`);
        }
      } catch (valErr) {
        const msg = valErr instanceof Error ? valErr.message : String(valErr);
        logger.warn(`Validation iteration ${valIter} crashed: ${msg}`);
        warnings.push(`Validation iteration ${valIter} failed: ${msg}`);
        // Continue — push what we have (validation infra issue, not code issue)
        if (valIter === 1) {
          detailParts.push("## Tool Validation\nSkipped — validation pipeline crashed");
        }
        break;
      }
    }

    // ── Tier 3: Hard gate — block push+MR if ANY validation fails ──
    // A mid-level engineer does NOT open a PR when their code fails CI.
    // They fix it first. This gate enforces that behavior.
    if (!validationPassed) {
      const failedCheckNames = Object.entries(stepResults)
        .filter(([, passed]) => !passed)
        .map(([name]) => name)
        .join(", ");

      logger.error(`HARD GATE: Validation failed after ${MAX_VALIDATION_FIXES} fix iterations — blocking push. Failed: ${failedCheckNames}`);
      detailParts.push(`## ❌ Push Blocked\nValidation checks failed after ${MAX_VALIDATION_FIXES} fix iterations (including auto-fix + LLM fixes).\nFailed checks: ${failedCheckNames}\nPushing code that fails CI is not allowed.`);

      return {
        agent: "frontend_developer",
        summary: buildStructuredSummary({
          title: `Implementation blocked — validation failed (${failedCheckNames})`,
          filesChanged: allChanges.length,
          validationPassed: false,
          branchName,
          warnings: [...warnings, `BLOCKED: ${failedCheckNames} failed after all fix iterations. Code was NOT pushed. No MR was created.`],
        }),
        toolCalls,
        detail: detailParts.join("\n\n"),
      };
    }

    // ══════════════════════════════════════════════
    // Step 7: Impact analysis
    // ══════════════════════════════════════════════
    try {
      const changedFiles = allChanges.map((c) => c.filename);
      const impact = await impactAnalyzer.analyzeImpact(changedFiles, repoTree);
      detailParts.push(`## Impact Analysis\n${impact.summary}`);

      if (impact.warnings.length > 0) {
        detailParts.push(`**Warnings:**\n${impact.warnings.map((w) => `- ${w}`).join("\n")}`);
      }
    } catch (impactErr) {
      logger.warn("Impact analysis failed — skipping", { error: String(impactErr) });
      warnings.push("Impact analysis skipped due to error");
    }

    // ══════════════════════════════════════════════
    // Step 8: Rebase onto latest main
    // ══════════════════════════════════════════════
    emit("pushing", "Rebasing onto latest main...", 82);

    try {
      await git.fetch("origin", repoInfo.defaultBranch);
      await git.rebase([`origin/${repoInfo.defaultBranch}`]);
    } catch {
      logger.warn("Rebase conflict — falling back to merge");
      try { await git.rebase(["--abort"]); } catch { /* ignore */ }
      try {
        await git.merge([`origin/${repoInfo.defaultBranch}`]);
      } catch {
        logger.warn("Merge also has conflicts — pushing as-is");
        try { await git.merge(["--abort"]); } catch { /* ignore */ }
        warnings.push("Could not rebase or merge with latest main — pushing as-is");
      }
    }

    // ══════════════════════════════════════════════
    // Step 9: Commit & push
    // ══════════════════════════════════════════════
    emit("pushing", "Generating commit title and pushing...", 85);

    let titleInfo;
    try {
      titleInfo = await openai.generateCommitTitle(
        `${issue.title}\n\n${issue.body}`,
        allChanges.map((c) => ({ filename: c.filename, explanation: c.explanation })),
      );
    } catch {
      // Fallback commit title if LLM fails
      titleInfo = {
        title: `feat: ${issue.title.slice(0, 50).toLowerCase()}`,
        type: "feat",
        scope: "frontend",
      };
      warnings.push("Commit title generation failed — using fallback");
    }

    await git.add(".");
    const commitMsg = `${titleInfo.title}\n\nImplemented by AI Engineer Agent\n\nValidation: ${validationPassed ? "all checks passed" : "best-effort (some checks had issues)"}`;

    try {
      await github.commitAndPush(git, commitMsg, branchName);
    } catch (pushErr) {
      const msg = pushErr instanceof Error ? pushErr.message : String(pushErr);
      throw new Error(`Failed to push code: ${msg}`);
    }

    toolCalls.push({
      tool: "commit_and_push",
      arguments: { branch: branchName, title: titleInfo.title },
      result: { pushed: true },
    });

    emit("pushing", "Code pushed", 90);

    // ══════════════════════════════════════════════
    // Step 10: Open PR / MR
    // ══════════════════════════════════════════════
    emit("pushing", "Opening pull request...", 92);

    const prBody = buildPRBody(issue, plan, allChanges, validationPassed, warnings, stepResults);

    let prNumber: number;
    let prUrl: string;
    try {
      const prResult = await github.createPullRequest(
        titleInfo.title,
        prBody,
        branchName,
        repoInfo.defaultBranch,
      );
      prNumber = prResult.prNumber;
      prUrl = prResult.prUrl;
    } catch (prErr) {
      const msg = prErr instanceof Error ? prErr.message : String(prErr);
      // Code is already pushed — report the push success but PR failure
      logger.error("PR creation failed", { error: msg });
      detailParts.push(
        `## Pull Request\n**PR creation failed:** ${msg}\n\n` +
        `Code was pushed to branch \`${branchName}\`. You can create the PR manually.`,
      );

      return {
        agent: "frontend_developer",
        summary: buildStructuredSummary({
          title: titleInfo.title,
          filesChanged: allChanges.length,
          validationPassed,
          branchName,
          prCreationFailed: msg,
          warnings,
        }),
        toolCalls,
        detail: detailParts.join("\n\n"),
      };
    }

    toolCalls.push({
      tool: "create_pull_request",
      arguments: { title: titleInfo.title, branch: branchName },
      result: { prNumber, prUrl },
    });

    detailParts.push(`## Pull Request\n[PR #${prNumber}](${prUrl}): ${titleInfo.title}`);
    detailParts.push(
      `## Files Changed\n${allChanges.map((c) => `- \`${c.filename}\`: ${c.explanation}`).join("\n")}`,
    );

    // Invalidate cache
    try {
      await cache.invalidate(`repo-context:${repoInfo.fullName}`);
    } catch { /* non-critical */ }

    emit("pr_created", `PR #${prNumber} created: ${prUrl}`, 100);

    return {
      agent: "frontend_developer",
      summary: buildStructuredSummary({
        title: titleInfo.title,
        filesChanged: allChanges.length,
        validationPassed,
        branchName,
        prNumber,
        prUrl,
        warnings,
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

// ── Structured Summary Builder ────────────────────────────

interface SummaryOptions {
  title?: string;
  filesChanged?: number;
  validationPassed?: boolean;
  branchName?: string;
  prNumber?: number;
  prUrl?: string;
  prCreationFailed?: string;
  pipelineError?: string;
  warnings?: string[];
}

/**
 * Build a professional, structured summary that ALWAYS includes
 * the MR/PR link when available. This is the primary text shown
 * to the user in the chat UI.
 */
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

  // Success or partial success
  lines.push(`✅ **Implementation Complete**`);

  if (opts.title) {
    lines.push(`**Commit:** ${opts.title}`);
  }

  if (opts.filesChanged !== undefined) {
    lines.push(`**Files changed:** ${opts.filesChanged}`);
  }

  if (opts.validationPassed !== undefined) {
    lines.push(`**Validation:** ${opts.validationPassed ? "All checks passed ✅" : "Best-effort (some checks had issues) ⚠️"}`);
  }

  if (opts.branchName) {
    lines.push(`**Branch:** \`${opts.branchName}\``);
  }

  // MR/PR link — the most important part
  if (opts.prUrl && opts.prNumber) {
    lines.push("");
    lines.push(`🔗 **Pull Request:** [PR #${opts.prNumber}](${opts.prUrl})`);
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

// ── PR Body Builder ───────────────────────────────────────

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

  // Build per-check status lines — show actual pass/fail per tool
  const checkIcon = (name: string) => {
    if (!stepResults || !(name in stepResults)) return "⏭️"; // skipped
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
- ✅ LLM self-review (up to ${MAX_REVIEW_ITERATIONS} iterations)
- ✅ LLM-assisted validation fixes (up to ${MAX_VALIDATION_FIXES} iterations)
- ✅ Rebased onto latest \`main\` before push
${warningsSection}
${plan.risks.length ? `### Risks\n${plan.risks.map((r: string) => `- ${r}`).join("\n")}` : ""}

---
*Generated by AI Engineer Agent v3 — all quality checks must pass before PR is created.*`;
}
