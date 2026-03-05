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
export async function syncTaskStatusToJira(task: Task, newStatus: TaskStatus): Promise<void> {
  try {
    const jiraKey = taskToJiraMap.get(task.id) ?? task.jiraKey;
    if (!jiraKey) {
      logger.warn("No Jira key found for task, skipping status sync", { taskId: task.id });
      return;
    }
    if (!(await isJiraConfigured())) return;

    await transitionJiraIssue(jiraKey, newStatus);

    logger.info("Task status synced to Jira", { taskId: task.id, jiraKey, newStatus });
  } catch (err) {
    logger.error("Failed to sync task status to Jira", {
      taskId: task.id,
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

/**
 * Await Jira sync for a task, ensuring jiraKey is available before proceeding.
 */
export async function awaitTaskJiraSync(task: Task): Promise<void> {
  if (task.jiraKey) return;
  // Give the fire-and-forget sync a moment to complete
  const maxWait = 5000;
  const interval = 200;
  let waited = 0;
  while (waited < maxWait) {
    await new Promise((r) => setTimeout(r, interval));
    waited += interval;
    if (task.jiraKey || taskToJiraMap.has(task.id)) {
      if (!task.jiraKey) task.jiraKey = taskToJiraMap.get(task.id);
      return;
    }
  }
  logger.warn("Timed out waiting for Jira sync", { taskId: task.id });
}
