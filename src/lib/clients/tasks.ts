// ──────────────────────────────────────────────────────────
// In-memory task store
//
// Replaces Jira — the PM agent creates tasks here and
// assigns them to other agents. Tasks are returned in the
// orchestrator response so the UI can render a task board.
// ──────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";
import type { TaskStatus } from "@/lib/agents/types";

export const TASK_STATUSES: TaskStatus[] = [
  "open",
  "in_progress",
  "review",
  "testing",
  "done",
];

export interface Task {
  id: string;
  title: string;
  description: string;
  type: "task" | "story" | "bug";
  priority: "high" | "medium" | "low";
  assignedTo: string; // agent role or team member
  createdBy: string; // agent role that created this task
  status: TaskStatus;
  labels: string[];
  createdAt: string;
}

let counter = 0;
const tasksByRequest = new Map<string, Task[]>();

/** Current request ID context — set by the orchestrator before running agents */
let activeRequestId: string | null = null;

export function setActiveRequestId(id: string) {
  activeRequestId = id;
}

export function getTasksForRequest(requestId: string): Task[] {
  return tasksByRequest.get(requestId) ?? [];
}

export function getTasksForRequestByCreator(requestId: string, createdBy: string): Task[] {
  return (tasksByRequest.get(requestId) ?? []).filter(t => t.createdBy === createdBy);
}

export interface CreateTaskParams {
  title: string;
  description: string;
  type?: string;
  priority?: string;
  assigned_to: string;
  labels?: string[];
}

export function createTask(params: CreateTaskParams, agentRole: string): Task {
  counter++;
  const task: Task = {
    id: `TASK-${counter}`,
    title: params.title,
    description: params.description,
    type: (params.type?.toLowerCase() as Task["type"]) ?? "task",
    priority: (params.priority?.toLowerCase() as Task["priority"]) ?? "medium",
    assignedTo: params.assigned_to,
    createdBy: agentRole,
    status: "open",
    labels: params.labels ?? [],
    createdAt: new Date().toISOString(),
  };

  // Store under active request
  if (activeRequestId) {
    const existing = tasksByRequest.get(activeRequestId) ?? [];
    existing.push(task);
    tasksByRequest.set(activeRequestId, existing);
  }

  logger.info("Task created", {
    id: task.id,
    title: task.title,
    assignedTo: task.assignedTo,
  });

  return task;
}

export function updateTaskStatus(taskId: string, newStatus: TaskStatus): Task | null {
  for (const tasks of tasksByRequest.values()) {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = newStatus;
      logger.info("Task status updated", { id: taskId, status: newStatus });
      return task;
    }
  }
  logger.warn("Task not found for status update", { taskId });
  return null;
}

export function getTasksForRequestAll(requestId: string): Task[] {
  return tasksByRequest.get(requestId) ?? [];
}

export function updateTasksByAssignee(
  requestId: string,
  assignee: string,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
): Task[] {
  const tasks = tasksByRequest.get(requestId) ?? [];
  const updated: Task[] = [];
  for (const task of tasks) {
    if (task.assignedTo === assignee && task.status === fromStatus) {
      task.status = toStatus;
      updated.push(task);
      logger.info("Task auto-transitioned", {
        id: task.id,
        from: fromStatus,
        to: toStatus,
      });
    }
  }
  return updated;
}

/** Transition ALL tasks in a request that match fromStatus, regardless of assignee */
export function updateTasksByRequestStatus(
  requestId: string,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
): Task[] {
  const tasks = tasksByRequest.get(requestId) ?? [];
  const updated: Task[] = [];
  for (const task of tasks) {
    if (task.status === fromStatus) {
      task.status = toStatus;
      updated.push(task);
      logger.info("Task auto-transitioned", {
        id: task.id,
        from: fromStatus,
        to: toStatus,
      });
    }
  }
  return updated;
}
