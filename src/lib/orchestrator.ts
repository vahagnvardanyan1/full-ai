// ──────────────────────────────────────────────────────────
// AI Orchestrator — Ruflo-Powered
//
// Central coordinator that:
//   1. Queries Ruflo MCP memory for past patterns
//   2. Detects task complexity via hookRoute
//   3. Initializes swarm topology via MCP
//   4. Asks GPT-4o to plan: which agents, in what phases
//   5. Executes phases sequentially, agents within a phase
//      run in parallel. Pre/post task hooks fire for learning.
//   6. Stores orchestration patterns in Ruflo memory
//   7. Persists a WorkflowRun document to MongoDB
//
// Graceful degradation: if MCP is unavailable, falls back
// to GPT-4o-only planning (original behavior).
// ──────────────────────────────────────────────────────────

import { getOpenAIClient } from "@/lib/clients/openai";
import { logger } from "@/lib/logger";
import { runAgent } from "@/lib/agents/runner";
import { ALL_TOOLS, CODER_TOOLS, REVIEWER_TOOLS, DEVOPS_TOOLS } from "@/lib/tools/definitions";
import { loadAgentSystemPrompt } from "@/lib/agents/prompt-loader";
import {
  setActiveRequestId,
  getTasksForRequestByCreator,
  getTasksForRequestAll,
  updateTasksByRequestStatus,
} from "@/lib/clients/tasks";
import {
  setActiveCodeRequestId,
  getFilesForRequest,
  getFilesForRequestByCreator,
} from "@/lib/clients/code-store";
import {
  getMCPClient,
  memorySearch,
  memoryStore,
  hookRoute,
  hookPreTask,
  hookPostTask,
  swarmInit,
} from "@/lib/mcp";
import type { AgentRole, AgentResponse, StreamEvent, AgentProgressStage } from "@/lib/agents/types";
import { ALL_AGENT_ROLES } from "@/lib/agents/types";
import { getSession, createSession, appendMessage } from "@/lib/session-store";
import { connectDB, isDBEnabled } from "@/lib/db/connection";
import { WorkflowRunModel } from "@/lib/db/models/workflow-run";
import { v4 as uuidv4 } from "uuid";

// ── Planning step ────────────────────────────────────────

interface Plan {
  summary: string;
  phases: AgentRole[][];
  agentInstructions: Record<string, string>;
}

const PLANNER_SYSTEM = `You are the orchestrator of an AI software team powered by Ruflo swarm coordination.
Given a user request, decide which agents should handle it, what each should do, and in what order.

Available Ruflo agents:
- researcher: Analyzes requirements, finds patterns, gathers context from codebase. Use for research-heavy tasks.
- architect: Designs system architecture, makes technical decisions, creates design documents.
- coder: Writes implementation code (frontend, backend, utilities — any language). Generates all files using write_code, then creates a feature branch and MUST open a GitHub Pull Request using create_github_pull_request. This is the primary coding agent.
- reviewer: Reviews the Pull Request created by coder. Reads generated code, leaves review comments on the PR via add_github_comment, checks quality/security/best practices, and gives a verdict (APPROVE, REQUEST_CHANGES, or COMMENT). MUST be in a LATER phase than coder.
- tester: Writes comprehensive test files (unit, integration, e2e). Opens a PR with tests targeting the feature branch. Focuses on edge cases and error handling.
- security_architect: Security design, threat modeling, vulnerability assessment. Leaves security review comments on PRs.
- performance_engineer: Performance optimization, profiling, benchmarking.
- coordinator: Swarm coordination for complex multi-agent tasks. Breaks down work and coordinates.
- devops: CI/CD and deployment. Creates/edits GitHub Actions workflows, Dockerfile, docker-compose, and deployment config. Does NOT run Docker or containers — it writes config; pipelines run in GitHub Actions or your deployment environment.

IMPORTANT: Agents are organized into phases. Agents within the same phase run in parallel.
Phases run sequentially — later phases receive the output (generated code, tasks) from earlier phases.

Respond with valid JSON only (no markdown fences):
{
  "summary": "Brief plan description",
  "phases": [
    ["coder"],
    ["reviewer"],
    ["tester"]
  ],
  "agentInstructions": {
    "coder": "Specific instructions for this agent...",
    "reviewer": "Specific instructions for this agent...",
    "tester": "Specific instructions for this agent..."
  }
}

Phase dependency rules:
- coder goes FIRST (or after researcher/architect for complex tasks). It writes all code and opens a GitHub PR.
- reviewer MUST be in a LATER phase than coder — it reviews the coder's PR. Never put reviewer in the same phase as coder.
- tester needs to see the actual code — put in a later phase after coder.
- researcher/architect go in phase 1 for research-heavy or architecture tasks.
- security_architect can go alongside reviewer for security-focused reviews.
- devops: Use when the user asks for CI/CD, GitHub Actions, deployment, Dockerfile, or pipeline config. Typically after coder (so workflows target the new code).

CRITICAL WORKFLOW for implementation tasks:
  Phase 1: [coder]                   — writes code, creates branch, opens PR
  Phase 2: [reviewer]               — reviews the PR, leaves comments
  Phase 3: [tester]                  — writes tests

For complex tasks that need research or architecture first:
  Phase 1: [researcher] or [architect]  — gathers context, designs approach
  Phase 2: [coder]                      — implements based on research/design
  Phase 3: [reviewer]                   — reviews the PR
  Phase 4: [tester]                     — writes tests

Be smart about which agents are actually needed:
- CI/CD or pipeline ONLY (e.g. "set up CI/CD", "add GitHub Actions workflow", "create Dockerfile", "pipeline that runs tests on PR"): use ONLY [devops]. Do NOT include coder, reviewer, or tester — there is no new application code to write or review.
- New feature, bug fix, or implementation: ALWAYS include coder → reviewer → tester. The coder MUST open a PR and the reviewer MUST review it.
- New feature AND CI/CD: use coder → reviewer → tester → devops (devops adds workflow/deploy config for the new code).
- Complex architecture decisions: include architect and/or researcher before coder.
- Security-sensitive changes: include security_architect alongside reviewer.
- Performance work: include performance_engineer.
- Simple question or clarification: just researcher.
- When in doubt, include more agents rather than fewer.

IMPORTANT for agentInstructions:
- For coder: ALWAYS include (1) "First reason: decide which existing files to modify vs which new files to create; do not assume everything is a new file." (2) Then what to build and which files. (3) Remind to create a branch and open a GitHub PR after implementation.
- For reviewer: ALWAYS instruct it to review the PR opened by the coder, leave GitHub comments, and give a verdict.
- For tester: Instruct it to write test files for the code produced by the coder.
- For devops: After writing workflow or config files (write_code), instruct it to open a GitHub PR with create_github_pull_request (branch e.g. devops/ci-workflow, created_by: "devops") so changes are pushed to the repo. Tell it to always include the PR link in its response summary.`;

const createPlan = async ({
  userMessage,
  context,
  memoryContext,
  routingHint,
}: {
  userMessage: string;
  context: string;
  memoryContext: string;
  routingHint: string;
}): Promise<Plan> => {
  const openai = getOpenAIClient();

  let prompt = "";
  if (memoryContext) prompt += `Relevant patterns from memory:\n${memoryContext}\n\n`;
  if (routingHint) prompt += `Routing analysis:\n${routingHint}\n\n`;
  if (context) prompt += `Previous context:\n${context}\n\n`;
  prompt += `New request: ${userMessage}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: PLANNER_SYSTEM },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Planner returned empty response");

  const parsed = JSON.parse(raw) as Plan;

  const validRoles = ALL_AGENT_ROLES as readonly string[];

  logger.info("Planner raw response", { raw: raw.slice(0, 500), validRoles });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawAny = parsed as any;
  if (!parsed.phases && rawAny.agents) {
    parsed.phases = [rawAny.agents];
  }

  const rawPhases = parsed.phases?.map((p) => [...p]);

  parsed.phases = parsed.phases
    .map((phase) => phase.filter((a) => validRoles.includes(a)))
    .filter((phase) => phase.length > 0);

  logger.info("Plan phase validation", { rawPhases, filteredPhases: parsed.phases });

  if (parsed.phases.length === 0) {
    parsed.phases = [["coder"]];
  }

  logger.info("Plan created", {
    phases: parsed.phases,
    summary: parsed.summary,
  });

  return parsed;
};

// ── Agent dispatcher ─────────────────────────────────────
// All agents are Ruflo agents. Each gets a system prompt loaded
// from .claude/agents/ and a role-specific tool set.

const ROLE_TOOL_MAP: Partial<Record<AgentRole, typeof ALL_TOOLS>> = {
  coder: CODER_TOOLS,
  reviewer: REVIEWER_TOOLS,
};

type AgentProgressCallback = (
  stage: string,
  message: string,
  progress: number,
) => void;

const dispatchAgent = async ({
  role,
  instructions,
  onProgress,
}: {
  role: AgentRole;
  instructions: string;
  onProgress?: AgentProgressCallback;
}): Promise<AgentResponse> => {
  try {
    const systemPrompt = await loadAgentSystemPrompt(role);
    return await runAgent({
      role,
      systemPrompt,
      userMessage: instructions,
      tools: ROLE_TOOL_MAP[role] ?? ALL_TOOLS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Agent ${role} failed`, { error: msg });
    return { agent: role, summary: `Agent ${role} encountered an error: ${msg}`, toolCalls: [], detail: msg };
  }
};

// ── Ruflo MCP integration helpers ────────────────────────

const tryInitMCP = async (): Promise<boolean> => {
  try {
    const client = getMCPClient();
    return await client.ensureReady();
  } catch (err) {
    logger.warn("MCP initialization failed, falling back to GPT-4o-only planning", {
      error: String(err),
    });
    return false;
  }
};

const getMemoryContext = async (userMessage: string): Promise<{ context: string; matchCount: number; topScore: number }> => {
  try {
    const result = await memorySearch({ query: userMessage, namespace: "patterns" });
    if (!result?.results?.length) return { context: "", matchCount: 0, topScore: 0 };

    const relevant = result.results.filter((r) => r.score > 0.5);
    if (relevant.length === 0) return { context: "", matchCount: 0, topScore: 0 };

    const context = relevant
      .map((r) => `[score=${r.score.toFixed(2)}] ${r.key}: ${r.value}`)
      .join("\n");

    return {
      context,
      matchCount: relevant.length,
      topScore: relevant[0].score,
    };
  } catch {
    return { context: "", matchCount: 0, topScore: 0 };
  }
};

const getRoutingHint = async (userMessage: string): Promise<string> => {
  try {
    const result = await hookRoute({ task: userMessage });
    if (!result) return "";

    return [
      `Complexity: ${result.complexity}`,
      `Routing code: ${result.routingCode}`,
      `Suggested agents: ${result.suggestedAgents.join(", ")}`,
      `Suggested topology: ${result.suggestedTopology}`,
    ].join("\n");
  } catch {
    return "";
  }
};

const initSwarm = async (userMessage: string): Promise<void> => {
  try {
    const routeResult = await hookRoute({ task: userMessage });
    const topology = routeResult?.suggestedTopology ?? "hierarchical";

    await swarmInit({
      topology: topology as "hierarchical" | "mesh" | "hierarchical-mesh",
      maxAgents: 8,
      strategy: "specialized",
    });
  } catch {
    // Swarm init is optional
  }
};

const storeOrchestrationPattern = async ({
  userMessage,
  plan,
  agentCount,
  success,
}: {
  userMessage: string;
  plan: Plan;
  agentCount: number;
  success: boolean;
}): Promise<void> => {
  try {
    const key = `orchestration-${Date.now()}`;
    const value = JSON.stringify({
      request: userMessage.slice(0, 200),
      plan: plan.summary,
      phases: plan.phases,
      agentCount,
      success,
      timestamp: new Date().toISOString(),
    });

    await memoryStore({ key, value, namespace: "patterns" });
  } catch {
    // Memory store is optional
  }
};

// ── WorkflowRun persistence helpers ──────────────────────

const persistEvent = async ({
  requestId,
  event,
}: {
  requestId: string;
  event: StreamEvent;
}): Promise<void> => {
  if (!isDBEnabled()) return;
  try {
    await connectDB();
    await WorkflowRunModel.updateOne(
      { requestId },
      { $push: { events: event } },
    );
  } catch (err) {
    logger.warn("Failed to persist workflow event", { requestId, error: String(err) });
  }
};

const persistAgentResult = async ({
  requestId,
  result,
  tasks,
  files,
}: {
  requestId: string;
  result: AgentResponse;
  tasks: ReturnType<typeof getTasksForRequestByCreator>;
  files: ReturnType<typeof getFilesForRequestByCreator>;
}): Promise<void> => {
  if (!isDBEnabled()) return;
  try {
    await connectDB();
    await WorkflowRunModel.updateOne(
      { requestId },
      {
        $push: { agentResults: result },
        $set: {
          tasks,
          files,
        },
      },
    );
  } catch (err) {
    logger.warn("Failed to persist agent result", { requestId, error: String(err) });
  }
};

// ── Streaming orchestrator ───────────────────────────────

export const orchestrateStream = async (
  userMessage: string,
  sessionId: string | undefined,
  onEvent: (event: StreamEvent) => void,
): Promise<void> => {
  const requestId = uuidv4();
  logger.info("Orchestration started", { requestId, sessionId });

  const sid = sessionId ?? uuidv4();
  let session = await getSession(sid);
  if (!session) session = await createSession(sid);

  const context = session.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  setActiveRequestId(requestId);
  setActiveCodeRequestId(requestId);

  const emit = (event: StreamEvent) => {
    onEvent(event);
    persistEvent({ requestId, event }).catch(() => undefined);
  };

  // Step 0: Initialize Ruflo MCP (non-blocking, optional)
  const mcpReady = await tryInitMCP();

  let memoryContext = "";
  let routingHint = "";

  if (mcpReady) {
    // Step 0a: Memory search for past patterns
    const memResult = await getMemoryContext(userMessage);
    memoryContext = memResult.context;

    if (memResult.matchCount > 0) {
      emit({
        type: "memory_hit",
        query: userMessage.slice(0, 100),
        matchCount: memResult.matchCount,
        topScore: memResult.topScore,
      });
    }

    // Step 0b: Complexity detection / routing
    routingHint = await getRoutingHint(userMessage);

    // Step 0c: Initialize swarm
    await initSwarm(userMessage);

    emit({
      type: "swarm_status",
      active: true,
      topology: "hierarchical",
      agentCount: 0,
    });
  }

  // Step 1: Plan (enhanced with memory context and routing hints)
  const plan = await createPlan({
    userMessage,
    context,
    memoryContext,
    routingHint,
  });

  // Create the WorkflowRun document in MongoDB
  if (isDBEnabled()) {
    try {
      await connectDB();
      await WorkflowRunModel.create({
        requestId,
        sessionId: sid,
        userMessage,
        status: "running",
        planSummary: plan.summary,
        phases: plan.phases,
        events: [],
        tasks: [],
        files: [],
        agentResults: [],
      });
    } catch (err) {
      logger.warn("Failed to create WorkflowRun document", { error: String(err) });
    }
  }

  const allAgents = plan.phases.flat();
  emit({ type: "plan", plan: plan.summary, agents: allAgents, phases: plan.phases });

  // Step 2: Execute phases sequentially
  const agentResults: AgentResponse[] = [];
  let codeBranch: string | null = null;
  let codePrUrl: string | null = null;
  let codePrNumber: number | null = null;

  const emitTasksSnapshot = () => {
    const allTasks = getTasksForRequestAll(requestId);
    if (allTasks.length > 0) {
      emit({ type: "tasks_updated", tasks: [...allTasks.map((t) => ({ ...t }))] });
    }
  };

  const runAgentAndEmit = async (role: AgentRole, instructions: string) => {
    emit({ type: "agent_start", agent: role });

    if (role === "coder") {
      updateTasksByRequestStatus(requestId, "open", "in_progress");
      emitTasksSnapshot();
    } else if (role === "tester") {
      updateTasksByRequestStatus(requestId, "review", "testing");
      updateTasksByRequestStatus(requestId, "in_progress", "testing");
      emitTasksSnapshot();
    }

    // Fire Ruflo pre-task hook
    if (mcpReady) {
      await hookPreTask({ description: `${role}: ${instructions.slice(0, 200)}` });
    }

    const progressCb: AgentProgressCallback = (stage, message, progress) => {
      emit({ type: "agent_progress", agent: role, stage: stage as AgentProgressStage, message, progress });
    };

    const result = await dispatchAgent({
      role,
      instructions,
      onProgress: progressCb,
    });

    // Fire Ruflo post-task hook with learning
    if (mcpReady) {
      const isSuccess = !result.summary.includes("error");
      await hookPostTask({
        taskId: `${requestId}-${role}`,
        success: isSuccess,
        trainNeural: true,
      });
    }

    if (role === "coder") {
      const branchFromToolCall = result.toolCalls.find(
        (tc) =>
          (tc.tool === "commit_and_push" || tc.tool === "clone_and_branch") &&
          typeof tc.arguments.branch === "string",
      )?.arguments.branch as string | undefined;

      codeBranch = branchFromToolCall ?? codeBranch;
      codePrUrl = result.prUrl ?? codePrUrl;

      const prToolCall = result.toolCalls.find(
        (tc) => tc.tool === "create_github_pull_request",
      );
      if (prToolCall?.result && typeof prToolCall.result === "object") {
        const prResult = prToolCall.result as Record<string, unknown>;
        if (typeof prResult.number === "number") {
          codePrNumber = prResult.number;
        }
        if (typeof prResult.html_url === "string") {
          codePrUrl = prResult.html_url;
        }
      }
    }

    const newTasks = getTasksForRequestByCreator(requestId, role);
    const newFiles = getFilesForRequestByCreator(requestId, role);

    agentResults.push(result);

    emit({ type: "agent_complete", response: result, tasks: newTasks, files: newFiles });

    persistAgentResult({
      requestId,
      result,
      tasks: getTasksForRequestAll(requestId),
      files: getFilesForRequest(requestId),
    }).catch(() => undefined);

    if (role === "coder") {
      updateTasksByRequestStatus(requestId, "open", "in_progress");
      if (newFiles.length > 0) {
        updateTasksByRequestStatus(requestId, "in_progress", "review");
      }
    } else if (role === "tester") {
      updateTasksByRequestStatus(requestId, "testing", "done");
    }
    emitTasksSnapshot();

    return result;
  };

  for (let i = 0; i < plan.phases.length; i++) {
    const phase = plan.phases[i];
    logger.info(`Executing phase ${i + 1}`, { agents: phase });

    let codeContext = "";
    if (i > 0) {
      const generatedFiles = getFilesForRequest(requestId);
      if (generatedFiles.length > 0) {
        codeContext = `\n\nThe following code files were generated by previous agents. Write your output based on this actual code:\n${generatedFiles
          .map(
            (f) =>
              `- ${f.filePath} (${f.language}): ${f.description}\n\`\`\`${f.language}\n${f.code}\n\`\`\``,
          )
          .join("\n\n")}`;
      }
    }

    const CODER_REASONING_REMINDER = `\n\n[MANDATORY] Before any write_code or create_github_pull_request: (1) Reason about the task — which existing files (if any) must be modified, which new files (if any) must be created. (2) State your approach briefly. (3) Then implement and only then open a PR. Do not skip reasoning.\n\n`;

    await Promise.all(
      phase.map((role) => {
        let baseInstructions = plan.agentInstructions[role] ?? userMessage;

        if (role === "coder") {
          baseInstructions = CODER_REASONING_REMINDER + baseInstructions;
        }

        let extraContext = "";

        if (role === "reviewer" && (codePrUrl || codeBranch)) {
          extraContext = `\n\nPR REVIEW CONTEXT:\n- Feature branch: ${codeBranch ?? "unknown"}\n- PR URL: ${codePrUrl ?? "not available"}\n- PR number (issue_number for comments): ${codePrNumber ?? "not available"}\n\nYou MUST review this PR. Steps:\n1. Read through all the generated code files below\n2. Use add_github_comment with issue_number=${codePrNumber ?? "the PR number"} to leave review comments\n3. Summarize your review verdict: APPROVE, REQUEST_CHANGES, or COMMENT`;
        }

        if (role === "tester" && codeBranch) {
          extraContext = `\n\nTEST BRANCH TARGETING CONTEXT:\n- Feature branch: ${codeBranch}\n- PR URL: ${codePrUrl ?? "not available"}\n- Write test files for the code produced by the coder. Open a PR with branch test/${codeBranch}-tests targeting the feature branch.`;
        }

        return runAgentAndEmit(role, baseInstructions + codeContext + extraContext);
      }),
    );
  }

  // Step 3: Save to session
  await appendMessage(sid, { role: "user", content: userMessage, timestamp: Date.now() });
  await appendMessage(sid, {
    role: "assistant",
    content: JSON.stringify({
      plan: plan.summary,
      results: agentResults.map((r) => ({ agent: r.agent, summary: r.summary })),
    }),
    timestamp: Date.now(),
  });

  // Step 4: Store orchestration pattern in Ruflo memory
  if (mcpReady) {
    const hasErrors = agentResults.some((r) => r.summary.includes("error"));
    await storeOrchestrationPattern({
      userMessage,
      plan,
      agentCount: agentResults.length,
      success: !hasErrors,
    });
  }

  // Step 5: Mark WorkflowRun as completed
  if (isDBEnabled()) {
    try {
      await connectDB();
      await WorkflowRunModel.updateOne(
        { requestId },
        {
          $set: {
            status: "completed",
            tasks: getTasksForRequestAll(requestId),
            files: getFilesForRequest(requestId),
          },
        },
      );
    } catch (err) {
      logger.warn("Failed to finalize WorkflowRun", { error: String(err) });
    }
  }

  logger.info("Orchestration complete", { requestId, agentCount: agentResults.length, mcpReady });

  emit({ type: "done", requestId });
};
