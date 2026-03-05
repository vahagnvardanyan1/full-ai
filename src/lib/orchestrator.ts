// ──────────────────────────────────────────────────────────
// AI Orchestrator
//
// Central coordinator that:
//   1. Receives the user request
//   2. Asks OpenAI to plan: which agents, in what phases
//   3. Executes phases sequentially, agents within a phase
//      run in parallel. Later phases receive output from
//      earlier ones as context.
//   4. Persists a WorkflowRun document to MongoDB so the UI
//      can restore state on page reload.
// ──────────────────────────────────────────────────────────

import { getOpenAIClient } from "@/lib/clients/openai";
import { logger } from "@/lib/logger";
import { runProductManager, type PMProgressCallback } from "@/lib/agents/product-manager";
import { runFrontendDeveloper, type ProgressCallback } from "@/lib/agents/frontend-developer";
import { runQAAgent, type QAProgressCallback } from "@/lib/agents/qa";
import { runDevOpsAgent } from "@/lib/agents/devops";
import {
  setActiveRequestId,
  getTasksForRequest,
  getTasksForRequestByCreator,
  getTasksForRequestAll,
  updateTasksByRequestStatus,
} from "@/lib/clients/tasks";
import { awaitTaskJiraSync } from "@/lib/clients/jira-sync";
import {
  setActiveCodeRequestId,
  getFilesForRequest,
  getFilesForRequestByCreator,
} from "@/lib/clients/code-store";
import type { AgentRole, AgentResponse, StreamEvent } from "@/lib/agents/types";
import { getSession, createSession, appendMessage } from "@/lib/session-store";
import { connectDB, isDBEnabled } from "@/lib/db/connection";
import { WorkflowRunModel } from "@/lib/db/models/workflow-run";
import { saveAgentRun } from "@/lib/agents/agent-history";
import { v4 as uuidv4 } from "uuid";

// ── Planning step ────────────────────────────────────────

interface Plan {
  summary: string;
  phases: AgentRole[][];
  agentInstructions: Record<string, string>;
}

const PLANNER_SYSTEM = `You are the orchestrator of an AI software team.
Given a user request, decide which agents should handle it, what each should do, and in what order.

Available agents:
- product_manager: Analyzes requests, breaks into subtasks, creates and assigns tasks
- frontend_developer: Writes actual implementation code (components, hooks, utils, pages) and opens GitHub Pull Requests
- qa: Writes actual test code (unit tests, integration tests) targeting the code that was written. Creates GitHub issues for QA tracking.
- devops: Writes CI/CD configs, triggers Vercel deployments

IMPORTANT: Agents are organized into phases. Agents within the same phase run in parallel.
Phases run sequentially — later phases receive the output (generated code, tasks) from earlier phases.
This means: if an agent needs to see what another agent produced, it must be in a LATER phase.

Respond with valid JSON only (no markdown fences):
{
  "summary": "Brief plan description",
  "phases": [
    ["product_manager"],
    ["frontend_developer"],
    ["qa", "devops"]
  ],
  "agentInstructions": {
    "product_manager": "Specific instructions for this agent...",
    "frontend_developer": "Specific instructions for this agent...",
    "qa": "Specific instructions for this agent...",
    "devops": "Specific instructions for this agent..."
  }
}

Think about dependencies:
- product_manager MUST always be alone in phase 1 — it creates tasks that other agents need.
- frontend_developer goes in phase 2 — it needs the tasks created by PM.
- qa needs to see the actual code to write meaningful tests — put qa in a later phase after frontend_developer.
- devops needs to know what was built to deploy it — put devops in a later phase after frontend_developer.
- If only product_manager is needed (e.g. for a question), a single phase is fine.

Be smart about which agents are actually needed:
- New feature, bug fix, or any implementation work: ALWAYS include all 4 agents (product_manager → frontend_developer → qa + devops). QA must always run after frontend_developer to validate the code.
- PM-only planning/spec requests (PRD, spec, roadmap, acceptance criteria) with no implementation ask: just product_manager.
- Simple question or clarification with no code changes: just product_manager.
- Deployment-only request: product_manager → devops.
- When in doubt, include more agents rather than fewer. The full pipeline is the default.`;

const createPlan = async (userMessage: string, context: string): Promise<Plan> => {
  const openai = getOpenAIClient();

  const prompt = context
    ? `Previous context:\n${context}\n\nNew request: ${userMessage}`
    : userMessage;

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

  const valid: AgentRole[] = [
    "product_manager",
    "frontend_developer",
    "qa",
    "devops",
  ];

  // Support both old "agents" flat array and new "phases" format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawAny = parsed as any;
  if (!parsed.phases && rawAny.agents) {
    parsed.phases = [rawAny.agents];
  }

  parsed.phases = parsed.phases
    .map((phase) => phase.filter((a) => valid.includes(a)))
    .filter((phase) => phase.length > 0);

  if (parsed.phases.length === 0) {
    parsed.phases = [["product_manager"]];
  }

  // Enforce: PM must be alone in its own phase so tasks exist before other agents run
  const firstPhase = parsed.phases[0];
  if (firstPhase && firstPhase.includes("product_manager") && firstPhase.length > 1) {
    const others = firstPhase.filter((a) => a !== "product_manager");
    parsed.phases[0] = ["product_manager"];
    parsed.phases.splice(1, 0, others);
  }

  logger.info("Plan created", {
    phases: parsed.phases,
    summary: parsed.summary,
  });

  return parsed;
};

// ── Agent dispatcher ─────────────────────────────────────

const AGENT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes per agent

const SIMPLE_RUNNERS: Record<
  string,
  (msg: string) => Promise<AgentResponse>
> = {
  qa: runQAAgent,
  devops: runDevOpsAgent,
};

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms),
    ),
  ]);

const dispatchAgent = async ({
  role,
  instructions,
  onProgress,
  onPMProgress,
  onQAProgress,
}: {
  role: AgentRole;
  instructions: string;
  onProgress?: ProgressCallback;
  onPMProgress?: PMProgressCallback;
  onQAProgress?: QAProgressCallback;
}): Promise<AgentResponse> => {
  const run = (): Promise<AgentResponse> => {
    if (role === "frontend_developer") return runFrontendDeveloper(instructions, onProgress);
    if (role === "product_manager") return runProductManager(instructions, onPMProgress);
    if (role === "qa") return runQAAgent(instructions, onQAProgress);

    const runner = SIMPLE_RUNNERS[role];
    if (!runner) {
      logger.warn(`No runner for agent role: ${role}`);
      return Promise.resolve({ agent: role, summary: `Agent ${role} is not implemented.`, toolCalls: [], detail: "" });
    }
    return runner(instructions);
  };

  try {
    return await withTimeout(run(), AGENT_TIMEOUT_MS, `Agent ${role}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Agent ${role} failed`, { error: msg });
    return { agent: role, summary: `Agent ${role} encountered an error: ${msg}`, toolCalls: [], detail: msg };
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

/**
 * Run the full orchestration pipeline, emitting SSE events
 * via `onEvent` as each agent starts and completes.
 *
 * The AI planner decides the phases. Agents within a phase
 * run in parallel. Later phases receive code context from
 * earlier phases.
 */
export const orchestrateStream = async (
  userMessage: string,
  sessionId: string | undefined,
  onEvent: (event: StreamEvent) => void,
): Promise<void> => {
  const requestId = uuidv4();
  logger.info("Orchestration started", { requestId, sessionId });

  // Resolve or create session
  const sid = sessionId ?? uuidv4();
  let session = await getSession(sid);
  if (!session) session = await createSession(sid);

  const context = session.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  // Step 1: Plan
  const plan = await createPlan(userMessage, context);

  // Register request ID for task/file tracking
  setActiveRequestId(requestId);
  setActiveCodeRequestId(requestId);

  // Create the WorkflowRun document in MongoDB immediately
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

  // Structural events that must be persisted before continuing
  const STRUCTURAL_EVENTS = new Set(["plan", "agent_start", "agent_complete", "tasks_updated", "done", "error"]);

  // Wrap onEvent to also persist every event to MongoDB
  // Structural events are awaited; agent_progress is fire-and-forget
  const emit = async (event: StreamEvent): Promise<void> => {
    onEvent(event);
    if (STRUCTURAL_EVENTS.has(event.type)) {
      await persistEvent({ requestId, event });
    } else {
      persistEvent({ requestId, event }).catch(() => undefined);
    }
  };

  const allAgents = plan.phases.flat();
  await emit({ type: "plan", plan: plan.summary, agents: allAgents, phases: plan.phases });

  // Step 2: Execute phases sequentially
  const agentResults: AgentResponse[] = [];
  let frontendBranchForQA: string | null = null;
  let frontendPrUrlForQA: string | null = null;

  const emitTasksSnapshot = async () => {
    const allTasks = getTasksForRequestAll(requestId);
    if (allTasks.length > 0) {
      await emit({ type: "tasks_updated", tasks: [...allTasks.map((t) => ({ ...t }))] });
    }
  };

  const runAgentAndEmit = async (role: AgentRole, instructions: string) => {
    await emit({ type: "agent_start", agent: role });

    if (role === "frontend_developer") {
      // Ensure Jira sync is complete before transitioning so jiraKey is available
      const tasks = getTasksForRequest(requestId);
      await Promise.all(tasks.map((t) => awaitTaskJiraSync(t)));
      updateTasksByRequestStatus(requestId, "open", "in_progress");
      await emitTasksSnapshot();
    } else if (role === "qa") {
      updateTasksByRequestStatus(requestId, "review", "testing");
      updateTasksByRequestStatus(requestId, "in_progress", "testing");
      await emitTasksSnapshot();
    }

    const progressCb: ProgressCallback = (stage, message, progress) => {
      emit({ type: "agent_progress", agent: role, stage, message, progress });
    };

    const pmProgressCb: PMProgressCallback = (stage, message, progress) => {
      emit({ type: "agent_progress", agent: role, stage, message, progress });
    };

    const qaProgressCb: QAProgressCallback = (stage, message, progress) => {
      emit({ type: "agent_progress", agent: role, stage, message, progress });
    };

    const result = await dispatchAgent({
      role,
      instructions,
      onProgress: progressCb,
      onPMProgress: pmProgressCb,
      onQAProgress: qaProgressCb,
    });

    if (role === "frontend_developer") {
      const branchFromToolCall = result.toolCalls.find(
        (tc) =>
          (tc.tool === "commit_and_push" || tc.tool === "clone_and_branch") &&
          typeof tc.arguments.branch === "string",
      )?.arguments.branch as string | undefined;

      frontendBranchForQA = branchFromToolCall ?? frontendBranchForQA;
      frontendPrUrlForQA = result.prUrl ?? frontendPrUrlForQA;
    }

    const newTasks = getTasksForRequestByCreator(requestId, role);
    const newFiles = getFilesForRequestByCreator(requestId, role);

    agentResults.push(result);

    await emit({ type: "agent_complete", response: result, tasks: newTasks, files: newFiles });

    // Apply post-agent status transitions BEFORE persisting so the DB
    // snapshot always has the latest task statuses
    if (role === "frontend_developer") {
      updateTasksByRequestStatus(requestId, "open", "in_progress");
      if (newFiles.length > 0) {
        updateTasksByRequestStatus(requestId, "in_progress", "review");
      }
    } else if (role === "qa") {
      updateTasksByRequestStatus(requestId, "testing", "done");
    } else if (role === "devops") {
      updateTasksByRequestStatus(requestId, "testing", "done");
      updateTasksByRequestStatus(requestId, "review", "done");
      updateTasksByRequestStatus(requestId, "in_progress", "done");
      updateTasksByRequestStatus(requestId, "open", "done");
    }
    await emitTasksSnapshot();

    // Persist agent result + current task/file snapshot (after status
    // transitions so the DB has up-to-date task statuses).
    // Await to ensure DB is consistent before next agent starts or user refreshes.
    await persistAgentResult({
      requestId,
      result,
      tasks: getTasksForRequestAll(requestId),
      files: getFilesForRequest(requestId),
    });

    return result;
  };

  try {
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

      await Promise.all(
        phase.map((role) => {
          const baseInstructions = plan.agentInstructions[role] ?? userMessage;
          const qaBranchContext =
            role === "qa" && frontendBranchForQA
              ? `\n\nQA BRANCH TARGETING CONTEXT:\n- Frontend feature branch: ${frontendBranchForQA}\n- Frontend PR URL: ${frontendPrUrlForQA ?? "not available"}\n- Create QA branch as qa/<frontend-branch>-tests and open PR against the frontend feature branch.`
              : "";
          const devopsBranchContext =
            role === "devops" && frontendBranchForQA
              ? `\n\nDEPLOYMENT CONTEXT:\n- The frontend feature branch is: ${frontendBranchForQA}\n- Use this exact branch name as the ref when triggering Vercel deployments. Do NOT guess or invent a branch name.`
              : "";
          return runAgentAndEmit(role, baseInstructions + codeContext + qaBranchContext + devopsBranchContext);
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

    // Mark WorkflowRun as completed with final snapshot
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

      // Save lightweight entry to generic agent_runs for dashboard history
      saveAgentRun({
        agentType: "orchestrator",
        status: "completed",
        input: { userMessage, requestId, sessionId: sid },
      }).catch(() => undefined);
    }

    logger.info("Orchestration complete", { requestId, agentCount: agentResults.length });

    await emit({ type: "done", requestId });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("Orchestration failed", { requestId, error: errorMsg });

    await emit({ type: "error", agent: "product_manager", message: errorMsg });

    // Mark WorkflowRun as failed in MongoDB
    if (isDBEnabled()) {
      try {
        await connectDB();
        await WorkflowRunModel.updateOne(
          { requestId },
          {
            $set: {
              status: "failed",
              tasks: getTasksForRequestAll(requestId),
              files: getFilesForRequest(requestId),
            },
          },
        );
      } catch (dbErr) {
        logger.warn("Failed to mark WorkflowRun as failed", { error: String(dbErr) });
      }
    }

    await emit({ type: "done", requestId });
  }
};
