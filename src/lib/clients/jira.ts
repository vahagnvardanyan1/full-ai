// ──────────────────────────────────────────────────────────
// Jira Cloud REST API client
//
// When JIRA_* env vars are set, task operations go through
// the real Jira API. When not configured, callers fall back
// to the existing in-memory store (same pattern as github.ts
// and vercel.ts).
//
// Auth: Basic auth (email + API token) per Atlassian docs.
// ──────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";
import type { TaskStatus } from "@/lib/agents/types";
import { getRuntimeJiraConfig, refreshJiraTokenIfNeeded } from "@/lib/clients/integration-store";

// ── Auth resolution: runtime OAuth → env vars → null ────

interface ResolvedJira {
  baseUrl: string;
  authHeader: string;
  projectKey: string;
  source: "runtime" | "env";
}

async function resolveJiraAuth(): Promise<ResolvedJira | null> {
  // 1. Runtime OAuth tokens (from Settings → Integrations UI)
  //    refreshJiraTokenIfNeeded() returns the config with a fresh token
  const runtime = await refreshJiraTokenIfNeeded();
  if (runtime?.accessToken && runtime.cloudId && runtime.projectKey) {
    return {
      // OAuth uses Atlassian's cloud API gateway
      baseUrl: `https://api.atlassian.com/ex/jira/${runtime.cloudId}`,
      authHeader: `Bearer ${runtime.accessToken}`,
      projectKey: runtime.projectKey,
      source: "runtime",
    };
  }

  // 2. Environment variables (existing behavior, untouched)
  if (
    process.env.JIRA_BASE_URL &&
    process.env.JIRA_EMAIL &&
    process.env.JIRA_API_TOKEN &&
    process.env.JIRA_PROJECT_KEY
  ) {
    const email = process.env.JIRA_EMAIL!;
    const token = process.env.JIRA_API_TOKEN!;
    const auth = Buffer.from(`${email}:${token}`).toString("base64");
    return {
      baseUrl: process.env.JIRA_BASE_URL!.replace(/\/+$/, ""),
      authHeader: `Basic ${auth}`,
      projectKey: process.env.JIRA_PROJECT_KEY!,
      source: "env",
    };
  }

  return null;
}

// ── Configuration ────────────────────────────────────────

export async function isJiraConfigured(): Promise<boolean> {
  return (await resolveJiraAuth()) !== null;
}

function getJiraConfig() {
  // Existing function preserved for backward compatibility
  // Internal callers should prefer resolveJiraAuth()
  return {
    baseUrl: process.env.JIRA_BASE_URL!.replace(/\/+$/, ""),
    email: process.env.JIRA_EMAIL!,
    token: process.env.JIRA_API_TOKEN!,
    projectKey: process.env.JIRA_PROJECT_KEY!,
  };
}

/** Resolve projectKey & browsable base URL from runtime or env */
function resolveProjectConfig() {
  const runtime = getRuntimeJiraConfig();
  if (runtime?.projectKey && runtime.siteUrl) {
    return {
      projectKey: runtime.projectKey,
      browseUrl: runtime.siteUrl.replace(/\/+$/, ""),
    };
  }
  return {
    projectKey: process.env.JIRA_PROJECT_KEY ?? "",
    browseUrl: (process.env.JIRA_BASE_URL ?? "").replace(/\/+$/, ""),
  };
}

// ── HTTP helper ──────────────────────────────────────────

async function jiraFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const resolved = await resolveJiraAuth();

  // Determine URL and auth header
  let url: string;
  let authHeader: string;

  if (resolved) {
    url = `${resolved.baseUrl}/rest/api/3${path}`;
    authHeader = resolved.authHeader;
  } else {
    // Fallback to legacy getJiraConfig() for any edge case
    const { baseUrl, email, token } = getJiraConfig();
    url = `${baseUrl}/rest/api/3${path}`;
    authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jira API ${res.status}: ${body}`);
  }

  // Some endpoints return 204 with no body
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

// ── Status mapping ───────────────────────────────────────
//
// Maps between local TaskStatus values and Jira status
// category names. Jira workflows differ per project, so we
// match by the *target status category name* when looking
// up transitions rather than hardcoding transition IDs.
//
// The Jira board should have these status columns:
//   To Do | In Progress | Code Review | QA In Progress | Ready to Merge | Done

/** Map Jira status name (lowercased) → local TaskStatus */
const JIRA_STATUS_TO_LOCAL: Record<string, TaskStatus> = {
  "to do": "open",
  "open": "open",
  "backlog": "open",
  "in progress": "in_progress",
  "code review": "review",
  "in review": "review",
  "review": "review",
  "qa in progress": "testing",
  "qa": "testing",
  "testing": "testing",
  "ready to merge": "ready_to_merge",
  "ready for merge": "ready_to_merge",
  "done": "done",
  "closed": "done",
  "resolved": "done",
};

/** Map local TaskStatus → possible Jira target status names (checked in order) */
const LOCAL_TO_JIRA_STATUS_NAMES: Record<TaskStatus, string[]> = {
  open: ["To Do", "Open", "Backlog"],
  in_progress: ["In Progress"],
  review: ["Code Review", "In Review", "Review"],
  testing: ["QA In Progress", "QA", "Testing"],
  ready_to_merge: ["Ready to Merge", "Ready for Merge"],
  done: ["Done", "Closed", "Resolved"],
};

export function mapJiraStatusToLocal(jiraStatusName: string): TaskStatus {
  const mapped = JIRA_STATUS_TO_LOCAL[jiraStatusName.toLowerCase()];
  if (mapped) return mapped;

  // Fuzzy fallback: check if any key is contained in the status name
  const lower = jiraStatusName.toLowerCase();
  for (const [key, status] of Object.entries(JIRA_STATUS_TO_LOCAL)) {
    if (lower.includes(key)) return status;
  }

  logger.warn(`Unknown Jira status "${jiraStatusName}", defaulting to "open"`);
  return "open";
}

// ── Issue type mapping ───────────────────────────────────

function mapTaskTypeToJira(type: string): string {
  switch (type.toLowerCase()) {
    case "bug":
      return "Bug";
    case "story":
      return "Story";
    case "task":
    default:
      return "Task";
  }
}

function mapPriorityToJira(priority: string): string {
  switch (priority.toLowerCase()) {
    case "high":
      return "High";
    case "low":
      return "Low";
    case "medium":
    default:
      return "Medium";
  }
}

// ── Plain-text → ADF converter (minimal) ────────────────

function textToADF(text: string) {
  // Convert markdown-ish text to Atlassian Document Format
  const paragraphs = text.split(/\n{2,}/).filter(Boolean);
  return {
    version: 1,
    type: "doc",
    content: paragraphs.map((para) => ({
      type: "paragraph",
      content: [{ type: "text", text: para.replace(/\n/g, " ").trim() }],
    })),
  };
}

// ── Public API ───────────────────────────────────────────

export interface JiraCreateResult {
  issueKey: string;
  issueId: string;
  url: string;
}

export interface CreateJiraIssueParams {
  title: string;
  description: string;
  type: string;
  priority: string;
  assignedTo: string;
  labels: string[];
}

/**
 * Create a Jira issue in the configured project.
 */
export async function createJiraIssue(
  params: CreateJiraIssueParams,
): Promise<JiraCreateResult> {
  const { projectKey, browseUrl: baseUrl } = resolveProjectConfig();

  logger.info("Creating Jira issue", {
    title: params.title,
    project: projectKey,
  });

  // Build labels: include agent assignment + user labels
  const labels = [
    `agent:${params.assignedTo}`,
    ...params.labels.filter(Boolean),
  ].map((l) => l.replace(/\s+/g, "-")); // Jira labels can't have spaces

  const body = {
    fields: {
      project: { key: projectKey },
      summary: params.title,
      description: textToADF(params.description),
      issuetype: { name: mapTaskTypeToJira(params.type) },
      priority: { name: mapPriorityToJira(params.priority) },
      labels,
    },
  };

  const data = await jiraFetch<{ id: string; key: string }>("/issue", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const result: JiraCreateResult = {
    issueKey: data.key,
    issueId: data.id,
    url: `${baseUrl}/browse/${data.key}`,
  };

  logger.info("Jira issue created", { ...result });
  return result;
}

// ── Transitions ──────────────────────────────────────────

interface JiraTransition {
  id: string;
  name: string;
  to: { name: string; id: string };
}

/**
 * Fetch available transitions for an issue and find the one
 * that moves it to the target local status.
 */
async function findTransition(
  issueKey: string,
  targetLocalStatus: TaskStatus,
): Promise<JiraTransition | null> {
  const data = await jiraFetch<{ transitions: JiraTransition[] }>(
    `/issue/${issueKey}/transitions`,
  );

  const targetNames = LOCAL_TO_JIRA_STATUS_NAMES[targetLocalStatus] ?? [];
  const lowerTargets = targetNames.map((n) => n.toLowerCase());

  // Try exact match on target status name first
  for (const t of data.transitions) {
    if (lowerTargets.includes(t.to.name.toLowerCase())) {
      return t;
    }
  }

  // Fuzzy: check if transition target contains any of our keywords
  for (const t of data.transitions) {
    const tLower = t.to.name.toLowerCase();
    for (const target of lowerTargets) {
      if (tLower.includes(target) || target.includes(tLower)) {
        return t;
      }
    }
  }

  logger.warn(
    `No Jira transition found for ${issueKey} → ${targetLocalStatus}`,
    { available: data.transitions.map((t) => `${t.name} → ${t.to.name}`) },
  );
  return null;
}

/**
 * Transition a Jira issue to a new status.
 * Returns true if the transition succeeded, false if skipped.
 */
export async function transitionJiraIssue(
  issueKey: string,
  targetStatus: TaskStatus,
): Promise<boolean> {
  logger.info("Transitioning Jira issue", { issueKey, targetStatus });

  const transition = await findTransition(issueKey, targetStatus);
  if (!transition) {
    logger.warn(`Skipping Jira transition for ${issueKey} — no matching transition`);
    return false;
  }

  await jiraFetch(`/issue/${issueKey}/transitions`, {
    method: "POST",
    body: JSON.stringify({ transition: { id: transition.id } }),
  });

  logger.info("Jira issue transitioned", {
    issueKey,
    transitionName: transition.name,
    toStatus: transition.to.name,
  });
  return true;
}

// ── Fetch issues ─────────────────────────────────────────

export interface JiraIssueInfo {
  key: string;
  id: string;
  summary: string;
  status: string;
  localStatus: TaskStatus;
  priority: string;
  issueType: string;
  labels: string[];
  url: string;
}

/**
 * Fetch all issues in the project, optionally filtered by JQL.
 */
export async function getJiraIssues(
  jql?: string,
): Promise<JiraIssueInfo[]> {
  const { projectKey, browseUrl: baseUrl } = resolveProjectConfig();
  const defaultJql = `project = "${projectKey}" ORDER BY created DESC`;
  const query = jql ?? defaultJql;

  const data = await jiraFetch<{
    issues: Array<{
      id: string;
      key: string;
      fields: {
        summary: string;
        status: { name: string };
        priority: { name: string };
        issuetype: { name: string };
        labels: string[];
      };
    }>;
  }>(`/search?jql=${encodeURIComponent(query)}&maxResults=50`);

  return data.issues.map((issue) => ({
    key: issue.key,
    id: issue.id,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    localStatus: mapJiraStatusToLocal(issue.fields.status.name),
    priority: issue.fields.priority?.name ?? "Medium",
    issueType: issue.fields.issuetype?.name ?? "Task",
    labels: issue.fields.labels ?? [],
    url: `${baseUrl}/browse/${issue.key}`,
  }));
}

/**
 * Get a single Jira issue.
 */
export async function getJiraIssue(issueKey: string): Promise<JiraIssueInfo> {
  const { browseUrl: baseUrl } = resolveProjectConfig();

  const data = await jiraFetch<{
    id: string;
    key: string;
    fields: {
      summary: string;
      status: { name: string };
      priority: { name: string };
      issuetype: { name: string };
      labels: string[];
    };
  }>(`/issue/${issueKey}`);

  return {
    key: data.key,
    id: data.id,
    summary: data.fields.summary,
    status: data.fields.status.name,
    localStatus: mapJiraStatusToLocal(data.fields.status.name),
    priority: data.fields.priority?.name ?? "Medium",
    issueType: data.fields.issuetype?.name ?? "Task",
    labels: data.fields.labels ?? [],
    url: `${baseUrl}/browse/${data.key}`,
  };
}
