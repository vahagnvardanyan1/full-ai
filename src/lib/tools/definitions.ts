// ──────────────────────────────────────────────────────────
// OpenAI function-calling tool definitions
//
// Each definition follows the OpenAI ChatCompletionTool schema.
// The orchestrator and individual agents reference these when
// configuring their chat completion requests.
// ──────────────────────────────────────────────────────────

import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const TOOL_CREATE_GITHUB_ISSUE: ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_github_issue",
    description:
      "Create a new issue in the configured GitHub repository. Use this to track implementation tasks, bugs, or feature requests.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short, descriptive issue title",
        },
        body: {
          type: "string",
          description:
            "Markdown body with acceptance criteria and context",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description:
            'Labels to apply (e.g. ["enhancement", "frontend"])',
        },
        assignees: {
          type: "array",
          items: { type: "string" },
          description: "GitHub usernames to assign",
        },
      },
      required: ["title", "body"],
    },
  },
};

export const TOOL_ADD_GITHUB_COMMENT: ChatCompletionTool = {
  type: "function",
  function: {
    name: "add_github_comment",
    description:
      "Add a comment to an existing GitHub issue. Use for QA checklists, status updates, or test results.",
    parameters: {
      type: "object",
      properties: {
        issue_number: {
          type: "number",
          description: "The issue number to comment on",
        },
        body: {
          type: "string",
          description: "Markdown comment body",
        },
      },
      required: ["issue_number", "body"],
    },
  },
};

export const TOOL_CREATE_GITHUB_PR: ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_github_pull_request",
    description:
      "Create a GitHub pull request. This automatically commits all code files you generated (via write_code) to the head branch and opens the PR. If the repo is empty or the base branch doesn't exist, it will be created automatically. You just need to provide the PR details.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "PR title" },
        body: {
          type: "string",
          description: "PR description in markdown — list files created, what changed, and how to test",
        },
        head: {
          type: "string",
          description: 'Feature branch name to create (e.g. "feature/landing-page")',
        },
        base: {
          type: "string",
          description: 'Target branch (usually "main")',
        },
        created_by: {
          type: "string",
          description:
            'Optional scope filter for code-store files by creator role (e.g. "qa", "frontend_developer").',
        },
        file_paths: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional explicit file path allowlist to include in the PR commit.",
        },
      },
      required: ["title", "body", "head", "base"],
    },
  },
};

export const TOOL_CREATE_TASK: ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_task",
    description:
      "Create an internal task and assign it to a team member or agent. Use for tracking product tasks, stories, and bugs.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short, descriptive task title",
        },
        description: {
          type: "string",
          description: "Detailed description with acceptance criteria",
        },
        type: {
          type: "string",
          enum: ["task", "story", "bug"],
          description: "Task type",
        },
        priority: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Task priority",
        },
        assigned_to: {
          type: "string",
          description:
            'Who should handle this task — use agent roles: "frontend_developer", "qa", "devops", or a team member name',
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Labels for categorization",
        },
      },
      required: ["title", "description", "assigned_to"],
    },
  },
};

export const TOOL_WRITE_CODE: ChatCompletionTool = {
  type: "function",
  function: {
    name: "write_code",
    description:
      "Generate a source code file. Use this to produce actual implementation code, test files, config files, etc.",
    parameters: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description:
            'Relative file path including extension, e.g. "src/components/LoginForm.tsx"',
        },
        language: {
          type: "string",
          description:
            'Programming language / file type, e.g. "typescript", "tsx", "css", "json"',
        },
        code: {
          type: "string",
          description:
            "The full source code content of the file. Must be complete and ready to use — no placeholders or TODOs.",
        },
        description: {
          type: "string",
          description:
            "Brief explanation of what this file does and why it was created.",
        },
      },
      required: ["file_path", "language", "code", "description"],
    },
  },
};

export const TOOL_UPDATE_TASK_STATUS: ChatCompletionTool = {
  type: "function",
  function: {
    name: "update_task_status",
    description:
      "Update the status of an existing task. Use this to move tasks through the workflow: open → in_progress → review → testing → done.",
    parameters: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: 'The task ID to update (e.g. "TASK-1")',
        },
        status: {
          type: "string",
          enum: ["open", "in_progress", "review", "testing", "done"],
          description: "The new status for the task",
        },
      },
      required: ["task_id", "status"],
    },
  },
};

export const TOOL_GET_VERCEL_PREVIEW_URL: ChatCompletionTool = {
  type: "function",
  function: {
    name: "get_vercel_preview_url",
    description:
      "Look up the Vercel preview deployment URL for a branch. Vercel auto-deploys from GitHub, so this fetches the existing deployment rather than triggering a new one.",
    parameters: {
      type: "object",
      properties: {
        branch: {
          type: "string",
          description: "The exact Git branch name to look up the preview deployment for.",
        },
      },
      required: ["branch"],
    },
  },
};

/** All tools available for function calling */
export const ALL_TOOLS: ChatCompletionTool[] = [
  TOOL_CREATE_GITHUB_ISSUE,
  TOOL_ADD_GITHUB_COMMENT,
  TOOL_CREATE_GITHUB_PR,
  TOOL_CREATE_TASK,
  TOOL_UPDATE_TASK_STATUS,
  TOOL_WRITE_CODE,
  TOOL_GET_VERCEL_PREVIEW_URL,
];

/** Subsets agents can use — keeps each agent's scope narrow */
export const PM_TOOLS: ChatCompletionTool[] = [
  TOOL_CREATE_TASK,
];

export const FRONTEND_DEV_TOOLS: ChatCompletionTool[] = [
  TOOL_WRITE_CODE,
  TOOL_CREATE_GITHUB_ISSUE,
  TOOL_CREATE_GITHUB_PR,
  TOOL_UPDATE_TASK_STATUS,
];

export const QA_TOOLS: ChatCompletionTool[] = [
  TOOL_WRITE_CODE,
  TOOL_CREATE_GITHUB_ISSUE,
  TOOL_CREATE_GITHUB_PR,
  TOOL_UPDATE_TASK_STATUS,
];

export const DEVOPS_TOOLS: ChatCompletionTool[] = [
  TOOL_WRITE_CODE,
  TOOL_GET_VERCEL_PREVIEW_URL,
  TOOL_UPDATE_TASK_STATUS,
];
