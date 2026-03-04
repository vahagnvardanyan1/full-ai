// ──────────────────────────────────────────────────────────
// Product Manager Agent — v3 Autonomous Pipeline
//
// Replaces the simple LLM-tool-calling PM with a full
// deterministic pipeline: context → requirements → feasibility →
// tasks → stories → risks → create tasks → structured output.
//
// Fully autonomous: handles errors at every stage, retries
// recoverable failures, and always produces tasks or a
// meaningful error report.
//
// CONSTRAINTS:
//   - NO code review (PM does not review code)
//   - NO GitHub issues (PM only creates internal tasks)
//   - Tools: create_task only
// ──────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";
import { createTask } from "@/lib/clients/tasks";

import { PMContextService } from "./services/context.service";
import { PMOpenAIService } from "./services/openai.service";
import type {
  PRDDocument,
  FeasibilityReport,
  PMTaskPlan,
  UserStory,
  RiskItem,
  PMProgressStage,
} from "./types";
import type { AgentResponse, ToolCall } from "../types";

/** Callback for sub-step progress events */
export type PMProgressCallback = (
  stage: PMProgressStage,
  message: string,
  progress: number,
) => void;

// ── Helpers ────────────────────────────────────────────────

/**
 * Extract keywords from user message for repo scanning.
 */
function extractKeywords(message: string): string[] {
  const stopWords = new Set([
    "the", "and", "for", "with", "that", "this", "from", "have", "has",
    "are", "was", "were", "will", "would", "could", "should", "can",
    "not", "but", "all", "any", "each", "make", "like", "add", "create",
    "build", "implement", "develop", "write", "need", "want", "please",
    "also", "new", "use", "using", "into", "about", "some", "more",
    "page", "component", "feature",
  ]);

  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));
}

/**
 * Build a rich task description from PM analysis.
 */
function buildTaskDescription(
  task: PMTaskPlan,
  story?: UserStory,
  relatedRisks?: RiskItem[],
): string {
  const parts: string[] = [];

  // Main description
  parts.push(task.description);

  // User story (if available)
  if (story) {
    parts.push(`\n### User Story`);
    parts.push(`As a ${story.asA}, I want ${story.iWant}, so that ${story.soThat}`);
  }

  // Acceptance criteria
  if (task.acceptanceCriteria.length > 0) {
    parts.push(`\n### Acceptance Criteria`);
    task.acceptanceCriteria.forEach((ac, i) => {
      parts.push(`- AC-${i + 1}: ${ac}`);
    });
  }

  // Edge cases from story
  if (story?.edgeCases && story.edgeCases.length > 0) {
    parts.push(`\n### Edge Cases to Handle`);
    story.edgeCases.forEach((ec) => parts.push(`- ${ec}`));
  }

  // Dependencies
  if (task.dependencies.length > 0) {
    parts.push(`\n### Dependencies`);
    task.dependencies.forEach((dep) => parts.push(`- Depends on: ${dep}`));
  }

  // Risks
  if (relatedRisks && relatedRisks.length > 0) {
    parts.push(`\n### Risks to Watch`);
    relatedRisks.forEach((r) =>
      parts.push(`- [${r.probability}/${r.impact}] ${r.description} — Mitigation: ${r.mitigation}`),
    );
  }

  // Estimate
  if (task.estimate) {
    parts.push(`\n**Estimate:** ${task.estimate}`);
  }

  return parts.join("\n");
}

// ── Main Pipeline ──────────────────────────────────────────

/**
 * Run the PM autonomous pipeline.
 *
 * Pipeline stages:
 *   1. Gather repo context (file tree, tech stack, existing pages)
 *   2. Analyze requirements → PRD
 *   3. Assess feasibility → complexity, risks, affected files
 *   4. Plan tasks → decompose into assignable work
 *   5. Write user stories → full As-a/I-want/So-that
 *   6. Assess risks → technical, scope, dependency risks
 *   7. Create tasks via create_task tool
 *   8. Build structured output
 *
 * Returns AgentResponse with the same signature as before.
 */
export async function runProductManager(
  userMessage: string,
  onProgress?: PMProgressCallback,
): Promise<AgentResponse> {
  const emit = onProgress ?? (() => {});
  const toolCalls: ToolCall[] = [];
  const detailParts: string[] = [];
  const warnings: string[] = [];

  const contextService = new PMContextService();
  const openai = new PMOpenAIService();

  try {
    // ══════════════════════════════════════════════
    // Stage 1: Gather Repository Context
    // ══════════════════════════════════════════════
    emit("gathering_context", "Reading repository structure and tech stack...", 5);

    let repoContext: string;
    let repoContextObj;
    try {
      repoContextObj = await contextService.gatherContext();
      repoContext = contextService.formatForPrompt(repoContextObj);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`PM context gathering failed: ${msg} — using minimal context`);
      repoContext = "Repository context unavailable. Plan based on the user request only.";
      warnings.push("Repo context unavailable — tasks may reference incorrect paths");
    }

    // Search for related files
    let relatedFilesContext = "";
    if (repoContextObj) {
      try {
        const keywords = extractKeywords(userMessage);
        if (keywords.length > 0) {
          const related = await contextService.findRelatedFiles(keywords, repoContextObj.fileTree);
          if (related.length > 0) {
            const contents = await contextService.readFiles(
              related.filter((f) => /\.(tsx?|jsx?|vue|svelte)$/.test(f)).slice(0, 5),
            );
            relatedFilesContext = `\n\n## Existing Files Related to This Request\n${related.map((f) => `  - ${f}`).join("\n")}`;
            if (contents.size > 0) {
              relatedFilesContext += "\n\n### File Previews:";
              for (const [file, content] of contents) {
                relatedFilesContext += `\n\n--- ${file} ---\n${content.slice(0, 1500)}`;
              }
            }
            detailParts.push(
              `## Related Files Found\n${related.slice(0, 15).map((f) => `- \`${f}\``).join("\n")}`,
            );
          }
        }
      } catch {
        logger.warn("PM related files scan failed — continuing without it");
      }
    }

    const enrichedContext = repoContext + relatedFilesContext;

    toolCalls.push({
      tool: "gather_context",
      arguments: { repo: repoContextObj?.repoFullName ?? "unknown" },
      result: {
        files: repoContextObj?.fileTree.length ?? 0,
        pages: repoContextObj?.existingPages.length ?? 0,
        components: repoContextObj?.existingComponents.length ?? 0,
        techStack: repoContextObj?.techStack ?? "unknown",
      },
    });

    emit("gathering_context", `Context: ${repoContextObj?.techStack ?? "unknown"}`, 12);

    // ══════════════════════════════════════════════
    // Stage 2: Requirements Analysis → PRD
    // ══════════════════════════════════════════════
    emit("analyzing_requirements", "Analyzing requirements and building PRD...", 15);

    let prd: PRDDocument;
    try {
      prd = await openai.analyzeRequirements(userMessage, enrichedContext);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Requirements analysis failed: ${msg} — using basic PRD`);
      prd = {
        summary: userMessage,
        goals: [userMessage.slice(0, 200)],
        userPersonas: ["End user"],
        scope: userMessage,
        outOfScope: "Not defined",
        successMetrics: ["Feature implemented and working"],
        acceptanceCriteria: [
          { id: "AC-1", description: "Feature works as described", testable: true, priority: "must" },
        ],
      };
      warnings.push("Requirements analysis failed — using basic PRD from user request");
    }

    detailParts.push(
      `## Requirements (PRD)\n**Summary:** ${prd.summary}\n**Goals:** ${prd.goals.join(", ")}\n**Scope:** ${prd.scope}\n**Out of Scope:** ${prd.outOfScope}\n**Acceptance Criteria:** ${prd.acceptanceCriteria.length}`,
    );

    toolCalls.push({
      tool: "analyze_requirements",
      arguments: { request: userMessage.slice(0, 100) },
      result: { criteria: prd.acceptanceCriteria.length, goals: prd.goals.length },
    });

    emit("analyzing_requirements", `PRD: ${prd.acceptanceCriteria.length} acceptance criteria`, 25);


    // ══════════════════════════════════════════════
    // Stage 3: Technical Feasibility Assessment
    // ══════════════════════════════════════════════
    emit("assessing_feasibility", "Assessing technical feasibility...", 28);

    let feasibility: FeasibilityReport;
    try {
      feasibility = await openai.assessFeasibility(prd, enrichedContext);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Feasibility assessment failed: ${msg} — using defaults`);
      feasibility = {
        complexity: 3,
        estimatedHours: 8,
        risks: [],
        technicalConstraints: [],
        recommendation: "Proceed with caution (feasibility assessment unavailable)",
        affectedFiles: [],
      };
      warnings.push("Feasibility assessment failed — using default estimates");
    }

    detailParts.push(
      `## Feasibility\n**Complexity:** ${feasibility.complexity}/5\n**Estimate:** ${feasibility.estimatedHours}h\n**Recommendation:** ${feasibility.recommendation}\n**Risks:** ${feasibility.risks.join("; ") || "None identified"}\n**Affected Files:** ${feasibility.affectedFiles.join(", ") || "None identified"}`,
    );

    toolCalls.push({
      tool: "assess_feasibility",
      arguments: {},
      result: {
        complexity: feasibility.complexity,
        hours: feasibility.estimatedHours,
        recommendation: feasibility.recommendation,
      },
    });

    emit("assessing_feasibility", `Complexity: ${feasibility.complexity}/5, ~${feasibility.estimatedHours}h`, 35);

    // ══════════════════════════════════════════════
    // Stage 4: Task Planning
    // ══════════════════════════════════════════════
    emit("planning_tasks", "Decomposing into assignable tasks...", 38);

    let tasks: PMTaskPlan[];
    try {
      tasks = await openai.planTasks(prd, feasibility, enrichedContext);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Task planning failed: ${msg}. Cannot continue without tasks.`);
    }

    if (tasks.length === 0) {
      throw new Error("Task planning produced zero tasks. The request may be too vague.");
    }

    // Enforce max 6 tasks
    if (tasks.length > 6) {
      logger.warn(`Task plan has ${tasks.length} tasks — trimming to 6`);
      tasks = tasks.slice(0, 6);
      warnings.push(`Trimmed task plan from ${tasks.length} to 6 tasks (Phase 1 scope)`);
    }

    detailParts.push(
      `## Task Plan (${tasks.length} tasks)\n${tasks.map((t) => `- [${t.priority}] **${t.title}** → ${t.assignedTo} (${t.estimate})`).join("\n")}`,
    );

    toolCalls.push({
      tool: "plan_tasks",
      arguments: {},
      result: {
        taskCount: tasks.length,
        breakdown: {
          frontend: tasks.filter((t) => t.assignedTo === "frontend_developer").length,
          qa: tasks.filter((t) => t.assignedTo === "qa").length,
          devops: tasks.filter((t) => t.assignedTo === "devops").length,
        },
      },
    });

    emit("planning_tasks", `${tasks.length} tasks planned`, 48);

    // ══════════════════════════════════════════════
    // Stage 5: User Story Writing
    // ══════════════════════════════════════════════
    emit("writing_stories", "Writing user stories...", 50);

    let stories: UserStory[] = [];
    try {
      stories = await openai.writeStories(tasks, prd);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Story writing failed: ${msg} — tasks will be created without stories`);
      warnings.push("User story generation failed — tasks created without stories");
    }

    if (stories.length > 0) {
      detailParts.push(
        `## User Stories (${stories.length})\n${stories.map((s) => `- As a ${s.asA}, I want ${s.iWant}, so that ${s.soThat}`).join("\n")}`,
      );
    }

    emit("writing_stories", `${stories.length} stories written`, 58);

    // ══════════════════════════════════════════════
    // Stage 6: Risk Assessment
    // ══════════════════════════════════════════════
    emit("assessing_risks", "Identifying risks...", 60);

    let risks: RiskItem[] = [];
    try {
      risks = await openai.assessRisks(prd, feasibility, tasks, enrichedContext);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Risk assessment failed: ${msg}`);
      warnings.push("Risk assessment failed — no risks identified");
    }

    if (risks.length > 0) {
      detailParts.push(
        `## Risks (${risks.length})\n${risks.map((r) => `- [${r.category}] ${r.description} (${r.probability}/${r.impact}) — Mitigation: ${r.mitigation}`).join("\n")}`,
      );
    }

    toolCalls.push({
      tool: "assess_risks",
      arguments: {},
      result: { riskCount: risks.length, highRisks: risks.filter((r) => r.impact === "high").length },
    });

    emit("assessing_risks", `${risks.length} risks identified`, 68);

    // ══════════════════════════════════════════════
    // Stage 7: Create Tasks (via create_task tool)
    // ══════════════════════════════════════════════
    emit("creating_tasks", "Creating tasks for the team...", 70);

    const createdTasks: { title: string; id: string; assignedTo: string }[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const progress = 70 + Math.round((i / tasks.length) * 25);
      emit("creating_tasks", `Creating task ${i + 1}/${tasks.length}: ${task.title.slice(0, 50)}...`, progress);

      // Match story to task (by index if same count, otherwise best effort)
      const story = stories[i];

      // Find risks related to this task
      const relatedRisks = risks.filter(
        (r) =>
          task.title.toLowerCase().includes(r.category) ||
          r.description.toLowerCase().includes(task.assignedTo),
      );

      const fullDescription = buildTaskDescription(task, story, relatedRisks);

      try {
        const result = await createTask(
          {
            title: task.title,
            description: fullDescription,
            type: task.type,
            priority: task.priority,
            assigned_to: task.assignedTo,
            labels: [
              task.estimate ? `estimate:${task.estimate}` : "",
              feasibility.complexity >= 4 ? "complex" : "",
            ].filter(Boolean),
          },
          "product_manager",
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const taskResult = result as any;
        createdTasks.push({
          title: task.title,
          id: taskResult.id ?? `TASK-${i + 1}`,
          assignedTo: task.assignedTo,
        });

        toolCalls.push({
          tool: "create_task",
          arguments: {
            title: task.title,
            assigned_to: task.assignedTo,
            priority: task.priority,
            type: task.type,
          },
          result: { id: taskResult.id, title: task.title },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to create task "${task.title}": ${msg}`);
        warnings.push(`Failed to create task: ${task.title}`);
      }
    }

    if (createdTasks.length === 0) {
      throw new Error("Failed to create any tasks. All create_task calls failed.");
    }

    emit("creating_tasks", `${createdTasks.length} tasks created`, 95);

    // ══════════════════════════════════════════════
    // Stage 8: Build Structured Output
    // ══════════════════════════════════════════════
    emit("complete", "PM analysis complete", 100);

    detailParts.push(
      `## Created Tasks (${createdTasks.length})\n${createdTasks.map((t) => `- **${t.id}**: ${t.title} → ${t.assignedTo}`).join("\n")}`,
    );

    const summary = buildStructuredSummary({
      prd,
      feasibility,
      tasks: createdTasks,
      stories,
      risks,
      warnings,
    });

    return {
      agent: "product_manager",
      summary,
      toolCalls,
      detail: detailParts.join("\n\n"),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("PM pipeline failed", { error: msg });

    return {
      agent: "product_manager",
      summary: `❌ **PM Pipeline Failed**\nError: ${msg}${warnings.length > 0 ? `\nWarnings: ${warnings.join("; ")}` : ""}`,
      toolCalls,
      detail: [...detailParts, `## Error\n${msg}`].join("\n\n"),
    };
  }
}

// ── Structured Summary Builder ────────────────────────────

interface SummaryOpts {
  prd: PRDDocument;
  feasibility: FeasibilityReport;
  tasks: { title: string; id: string; assignedTo: string }[];
  stories: UserStory[];
  risks: RiskItem[];
  warnings: string[];
}

function buildStructuredSummary(opts: SummaryOpts): string {
  const lines: string[] = [];

  lines.push("✅ **PM Analysis Complete**");
  lines.push("");

  // PRD summary
  lines.push(`**Summary:** ${opts.prd.summary}`);
  lines.push(`**Scope:** ${opts.prd.scope}`);
  lines.push(`**Complexity:** ${opts.feasibility.complexity}/5 (~${opts.feasibility.estimatedHours}h)`);
  lines.push(`**Recommendation:** ${opts.feasibility.recommendation}`);
  lines.push("");

  // Tasks created
  lines.push(`📋 **Tasks Created:** ${opts.tasks.length}`);
  for (const task of opts.tasks) {
    lines.push(`  - **${task.id}**: ${task.title} → ${task.assignedTo}`);
  }

  // Stories
  if (opts.stories.length > 0) {
    lines.push("");
    lines.push(`📖 **User Stories:** ${opts.stories.length}`);
  }

  // Risks
  const highRisks = opts.risks.filter((r) => r.impact === "high" || r.probability === "high");
  if (highRisks.length > 0) {
    lines.push("");
    lines.push(`⚠️ **High Risks:** ${highRisks.length}`);
    for (const risk of highRisks) {
      lines.push(`  - [${risk.category}] ${risk.description}`);
    }
  }

  // Warnings
  if (opts.warnings.length > 0) {
    lines.push("");
    lines.push(`📋 **Pipeline Warnings:** ${opts.warnings.length}`);
  }

  return lines.join("\n");
}
