// ──────────────────────────────────────────────────────────
// AI Orchestrator
//
// Central coordinator that:
//   1. Receives the user request
//   2. Asks OpenAI to plan: which agents, in what phases
//   3. Executes phases sequentially, agents within a phase
//      run in parallel. Later phases receive output from
//      earlier ones as context.
// ──────────────────────────────────────────────────────────

import { getOpenAIClient } from "@/lib/clients/openai";
import { logger } from "@/lib/logger";
import { runProductManager } from "@/lib/agents/product-manager";
import { runFrontendDeveloper, type ProgressCallback } from "@/lib/agents/frontend-developer";
import { runQAAgent } from "@/lib/agents/qa-agent";
import { runDevOpsAgent } from "@/lib/agents/devops-agent";
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
import type { AgentRole, AgentResponse, StreamEvent } from "@/lib/agents/types";
import {
  getSession,
  createSession,
  appendMessage,
} from "@/lib/session-store";
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
- Simple question or clarification with no code changes: just product_manager.
- Deployment-only request: product_manager → devops.
- When in doubt, include more agents rather than fewer. The full pipeline is the default.`;

async function createPlan(userMessage: string, context: string): Promise<Plan> {
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

  // Validate agent names and filter invalid ones
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
    // Backwards compat: flat array → single phase
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
}

// ── Agent dispatcher ─────────────────────────────────────

/** Simple agent runners (PM, QA, DevOps) — same signature as before */
const SIMPLE_RUNNERS: Record<
  string,
  (msg: string) => Promise<AgentResponse>
> = {
  product_manager: runProductManager,
  qa: runQAAgent,
  devops: runDevOpsAgent,
};

async function dispatchAgent(
  role: AgentRole,
  instructions: string,
  onProgress?: ProgressCallback,
): Promise<AgentResponse> {
  // Frontend developer uses the v3 pipeline with progress callback
  if (role === "frontend_developer") {
    try {
      return await runFrontendDeveloper(instructions, onProgress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Frontend developer failed", { error: msg });
      return {
        agent: role,
        summary: `Agent ${role} encountered an error: ${msg}`,
        toolCalls: [],
        detail: msg,
      };
    }
  }

  const runner = SIMPLE_RUNNERS[role];
  if (!runner) {
    logger.warn(`No runner for agent role: ${role}`);
    return {
      agent: role,
      summary: `Agent ${role} is not implemented.`,
      toolCalls: [],
      detail: "",
    };
  }

  try {
    return await runner(instructions);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Agent ${role} failed`, { error: msg });
    return {
      agent: role,
      summary: `Agent ${role} encountered an error: ${msg}`,
      toolCalls: [],
      detail: msg,
    };
  }
}

// ── Streaming orchestrator ───────────────────────────────

/**
 * Run the full orchestration pipeline, emitting SSE events
 * via `onEvent` as each agent starts and completes.
 *
 * The AI planner decides the phases. Agents within a phase
 * run in parallel. Later phases receive code context from
 * earlier phases.
 */
export async function orchestrateStream(
  userMessage: string,
  sessionId: string | undefined,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const requestId = uuidv4();
  logger.info("Orchestration started", { requestId, sessionId });

  // Resolve or create session
  const sid = sessionId ?? uuidv4();
  let session = getSession(sid);
  if (!session) session = createSession(sid);

  const context = session.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  // Step 1: Plan
  const plan = await createPlan(userMessage, context);

  // Register request ID for task/file tracking
  setActiveRequestId(requestId);
  setActiveCodeRequestId(requestId);

  // Flatten phases for the plan event
  const allAgents = plan.phases.flat();
  onEvent({ type: "plan", plan: plan.summary, agents: allAgents, phases: plan.phases });

  // Step 2: Execute phases sequentially
  const agentResults: AgentResponse[] = [];

  function emitTasksSnapshot() {
    const allTasks = getTasksForRequestAll(requestId);
    if (allTasks.length > 0) {
      onEvent({ type: "tasks_updated", tasks: [...allTasks.map(t => ({ ...t }))] });
    }
  }

  async function runAgentAndEmit(role: AgentRole, instructions: string) {
    onEvent({ type: "agent_start", agent: role });

    // ── On-start transitions (tasks exist from prior phases)
    if (role === "frontend_developer") {
      // PM already finished in phase 1 — tasks exist, move to in_progress
      updateTasksByRequestStatus(requestId, "open", "in_progress");
      emitTasksSnapshot();
    } else if (role === "qa") {
      updateTasksByRequestStatus(requestId, "review", "testing");
      updateTasksByRequestStatus(requestId, "in_progress", "testing");
      emitTasksSnapshot();
    }

    // Build progress callback for agents that support it (frontend_developer)
    const progressCb: ProgressCallback = (stage, message, progress) => {
      onEvent({ type: "agent_progress", agent: role, stage, message, progress });
    };

    const result = await dispatchAgent(role, instructions, progressCb);

    const newTasks = getTasksForRequestByCreator(requestId, role);
    const newFiles = getFilesForRequestByCreator(requestId, role);

    agentResults.push(result);

    onEvent({
      type: "agent_complete",
      response: result,
      tasks: newTasks,
      files: newFiles,
    });

    // ── On-complete transitions (status-only matching, no assignee filtering)
    if (role === "frontend_developer") {
      // Sweep any still-open tasks to in_progress first
      updateTasksByRequestStatus(requestId, "open", "in_progress");
      if (newFiles.length > 0) {
        // Code produced → ready for review
        updateTasksByRequestStatus(requestId, "in_progress", "review");
      }
    } else if (role === "qa") {
      // Testing complete → done
      updateTasksByRequestStatus(requestId, "testing", "done");
    } else if (role === "devops") {
      // Deployment complete → everything done
      updateTasksByRequestStatus(requestId, "testing", "done");
      updateTasksByRequestStatus(requestId, "review", "done");
      updateTasksByRequestStatus(requestId, "in_progress", "done");
      updateTasksByRequestStatus(requestId, "open", "done");
    }
    emitTasksSnapshot();

    return result;
  }

  for (let i = 0; i < plan.phases.length; i++) {
    const phase = plan.phases[i];
    logger.info(`Executing phase ${i + 1}`, { agents: phase });

    // For phases after the first, append code context from earlier phases
    // so agents like QA and DevOps can see what was built
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
        const baseInstructions =
          plan.agentInstructions[role] ?? userMessage;
        const instructions = baseInstructions + codeContext;
        return runAgentAndEmit(role, instructions);
      }),
    );
  }

  // Step 3: Save to session
  appendMessage(sid, {
    role: "user",
    content: userMessage,
    timestamp: Date.now(),
  });
  appendMessage(sid, {
    role: "assistant",
    content: JSON.stringify({
      plan: plan.summary,
      results: agentResults.map((r) => ({
        agent: r.agent,
        summary: r.summary,
      })),
    }),
    timestamp: Date.now(),
  });

  logger.info("Orchestration complete", {
    requestId,
    agentCount: agentResults.length,
  });

  // Final event
  onEvent({ type: "done", requestId });
}
