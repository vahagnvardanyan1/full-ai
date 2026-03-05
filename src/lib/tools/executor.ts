// ──────────────────────────────────────────────────────────
// Tool executor — dispatches OpenAI function calls to the
// correct API client and returns a serializable result.
// ──────────────────────────────────────────────────────────

import { execSync } from "child_process";

import {
  createGitHubIssue,
  addGitHubComment,
  createGitHubPullRequest,
} from "@/lib/clients/github";
import { createTask, updateTaskStatus } from "@/lib/clients/tasks";
import { writeCode } from "@/lib/clients/code-store";
import { triggerVercelDeployment } from "@/lib/clients/vercel";
import {
  swarmInit,
  memorySearch,
  memoryStore,
  agentSpawn,
} from "@/lib/mcp";
import { RUN_LOCAL_COMMAND_ALLOWED_PREFIXES } from "@/lib/tools/definitions";
import { logger } from "@/lib/logger";

const RUN_LOCAL_DISALLOWED = /[;|&`$()\n]/;

function runLocalCommand({
  command,
  timeoutSeconds = 120,
}: {
  command: string;
  timeoutSeconds?: number;
}): { ok: boolean; stdout: string; stderr: string; error?: string } {
  const trimmed = command.trim();
  if (!trimmed) {
    return { ok: false, stdout: "", stderr: "", error: "Empty command" };
  }
  if (RUN_LOCAL_DISALLOWED.test(trimmed)) {
    return { ok: false, stdout: "", stderr: "", error: "Command may not contain ; | & ` $ ( ) or newline" };
  }
  const lower = trimmed.toLowerCase();
  const allowed = RUN_LOCAL_COMMAND_ALLOWED_PREFIXES.some((p) => lower.startsWith(p.toLowerCase()));
  if (!allowed) {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      error: `Command must start with one of: ${RUN_LOCAL_COMMAND_ALLOWED_PREFIXES.join(", ")}`,
    };
  }
  try {
    const timeoutMs = Math.min(Math.max(Number(timeoutSeconds) || 120, 5), 300) * 1000;
    const stdout = execSync(trimmed, {
      encoding: "utf-8",
      cwd: process.cwd(),
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
    }) as string;
    return { ok: true, stdout: stdout ?? "", stderr: "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stderr = err instanceof Error && "stderr" in err ? String((err as { stderr?: Buffer }).stderr ?? "") : "";
    return { ok: false, stdout: "", stderr, error: msg };
  }
}

/**
 * Execute a tool call produced by OpenAI function calling.
 *
 * @param name      — the function name from the model's tool_call
 * @param args      — the parsed JSON arguments
 * @param agentRole — which agent invoked this tool (used for attribution)
 * @returns serializable result object
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  agentRole?: string,
): Promise<unknown> {
  logger.info("Executing tool", { name, args });

  switch (name) {
    // ── GitHub ─────────────────────────────────────────
    case "create_github_issue":
      return createGitHubIssue({
        title: args.title as string,
        body: args.body as string,
        labels: args.labels as string[] | undefined,
        assignees: args.assignees as string[] | undefined,
      });

    case "add_github_comment":
      return addGitHubComment({
        issueNumber: args.issue_number as number,
        body: args.body as string,
      });

    case "create_github_pull_request":
      return createGitHubPullRequest({
        title: args.title as string,
        body: args.body as string,
        head: args.head as string,
        base: args.base as string,
        created_by: args.created_by as string | undefined,
        file_paths: args.file_paths as string[] | undefined,
      });

    // ── Tasks ─────────────────────────────────────────
    case "create_task":
      return createTask(
        {
          title: args.title as string,
          description: args.description as string,
          type: args.type as string | undefined,
          priority: args.priority as string | undefined,
          assigned_to: args.assigned_to as string,
          labels: args.labels as string[] | undefined,
        },
        agentRole ?? "unknown",
      );

    case "update_task_status":
      return updateTaskStatus(
        args.task_id as string,
        args.status as "open" | "in_progress" | "review" | "testing" | "done",
      );

    // ── Code generation ──────────────────────────────
    case "write_code":
      return writeCode(
        {
          file_path: args.file_path as string,
          language: args.language as string,
          code: args.code as string,
          description: args.description as string,
        },
        agentRole ?? "unknown",
      );

    // ── Vercel ────────────────────────────────────────
    case "trigger_vercel_deployment":
      return triggerVercelDeployment({
        ref: args.ref as string | undefined,
        target: args.target as "production" | "preview" | undefined,
      });

    case "run_local_command":
      if (agentRole !== "devops") {
        return { ok: false, stdout: "", stderr: "", error: "run_local_command is only available to the devops agent" };
      }
      return runLocalCommand({
        command: args.command as string,
        timeoutSeconds: args.timeout_seconds as number | undefined,
      });

    // ── Ruflo MCP proxy tools ─────────────────────────
    case "swarm_init":
      return swarmInit({
        topology: args.topology as "hierarchical" | "mesh" | "hierarchical-mesh" | undefined,
        maxAgents: args.maxAgents as number | undefined,
        strategy: args.strategy as "balanced" | "specialized" | "adaptive" | undefined,
      });

    case "memory_search":
      return memorySearch({
        query: args.query as string,
        namespace: args.namespace as string | undefined,
      });

    case "memory_store":
      return memoryStore({
        key: args.key as string,
        value: args.value as string,
        namespace: args.namespace as string | undefined,
      });

    case "agent_spawn":
      return agentSpawn({
        type: args.type as string,
        name: args.name as string,
      });

    default:
      logger.warn("Unknown tool called", { name });
      throw new Error(`Unknown tool: ${name}`);
  }
}
