// ──────────────────────────────────────────────────────────
// Task-to-Jira sync bridge
//
// Fire-and-forget bridge that mirrors in-memory tasks to Jira
// when a runtime OAuth connection is active. Failures are
// logged but never break the orchestration pipeline.
// ──────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";
import { isJiraConfigured, createJiraIssue, transitionJiraIssue } from "@/lib/clients/jira";
import type { Task } from "@/lib/clients/tasks";
import type { TaskStatus } from "@/lib/agents/types";

// Maps local task ID → Jira issue key
const taskToJiraMap = new Map<string, string>();

/**
 * Sync a newly created task to Jira. Non-blocking: mutates task.jiraKey
 * and task.jiraUrl on success, logs on failure.
 */
export async function syncTaskToJira(task: Task): Promise<void> {
  try {
    if (!(await isJiraConfigured())) return;

    const result = await createJiraIssue({
      title: task.title,
      description: task.description,
      type: task.type,
      priority: task.priority,
      assignedTo: task.assignedTo,
      labels: task.labels,
    });

    taskToJiraMap.set(task.id, result.issueKey);
    task.jiraKey = result.issueKey;
    task.jiraUrl = result.url;

    logger.info("Task synced to Jira", {
      taskId: task.id,
      jiraKey: result.issueKey,
    });
  } catch (err) {
    logger.error("Failed to sync task to Jira", {
      taskId: task.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Sync a task status change to Jira. Non-blocking.
 */
export async function syncTaskStatusToJira(taskId: string, newStatus: TaskStatus): Promise<void> {
  try {
    const jiraKey = taskToJiraMap.get(taskId);
    if (!jiraKey) return;
    if (!(await isJiraConfigured())) return;

    await transitionJiraIssue(jiraKey, newStatus);

    logger.info("Task status synced to Jira", { taskId, jiraKey, newStatus });
  } catch (err) {
    logger.error("Failed to sync task status to Jira", {
      taskId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Look up the Jira issue key for a local task ID.
 */
export function getJiraKeyForTask(taskId: string): string | undefined {
  return taskToJiraMap.get(taskId);
}
