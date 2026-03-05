// ──────────────────────────────────────────────────────────
// Tool executor — dispatches OpenAI function calls to the
// correct API client and returns a serializable result.
// ──────────────────────────────────────────────────────────

import {
  createGitHubIssue,
  addGitHubComment,
  createGitHubPullRequest,
} from "@/lib/clients/github";
import { createTask, updateTaskStatus } from "@/lib/clients/tasks";
import { writeCode } from "@/lib/clients/code-store";
import { getVercelPreviewUrl } from "@/lib/clients/vercel";
import { logger } from "@/lib/logger";

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
    case "get_vercel_preview_url":
      return getVercelPreviewUrl({
        branch: args.branch as string,
      });

    default:
      logger.warn("Unknown tool called", { name });
      throw new Error(`Unknown tool: ${name}`);
  }
}
