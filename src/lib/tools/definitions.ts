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
            'Optional scope filter for code-store files by creator role (e.g. "coder", "tester", "reviewer").',
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
            'Who should handle this task — use agent roles: "coder", "reviewer", "tester", "architect", or a team member name',
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

export const TOOL_TRIGGER_VERCEL_DEPLOYMENT: ChatCompletionTool = {
  type: "function",
  function: {
    name: "trigger_vercel_deployment",
    description:
      "Trigger a new Vercel deployment for the configured project.",
    parameters: {
      type: "object",
      properties: {
        ref: {
          type: "string",
          description:
            'Git ref to deploy (branch, tag, or SHA). Defaults to "main".',
        },
        target: {
          type: "string",
          enum: ["production", "preview"],
          description: "Deploy target environment",
        },
      },
    },
  },
};

/** Allowed command prefixes for run_local_command (DevOps local deployment). No shell metacharacters; single command only. */
export const RUN_LOCAL_COMMAND_ALLOWED_PREFIXES = [
  "docker ",
  "docker-compose ",
  "docker compose ",
  "npm run ",
  "pnpm run ",
  "yarn ",
  "npx ",
] as const;

export const TOOL_RUN_LOCAL_COMMAND: ChatCompletionTool = {
  type: "function",
  function: {
    name: "run_local_command",
    description:
      "Run a single local command for deployment or dev setup. Allowed: docker, docker-compose, npm run, pnpm run, yarn, npx. Use for local Docker deployment (e.g. 'docker compose up -d') or starting dev servers. Runs in project root with a timeout. Only available to the devops agent.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description:
            "Exact command to run (e.g. 'docker compose up -d', 'npm run build'). Must start with an allowed prefix.",
        },
        timeout_seconds: {
          type: "number",
          description: "Max execution time in seconds. Default 120.",
        },
      },
      required: ["command"],
    },
  },
};

// ── Ruflo MCP proxy tools ────────────────────────────────

export const TOOL_SWARM_INIT: ChatCompletionTool = {
  type: "function",
  function: {
    name: "swarm_init",
    description:
      "Initialize a Ruflo swarm for multi-agent coordination. Sets up the topology and agent strategy.",
    parameters: {
      type: "object",
      properties: {
        topology: {
          type: "string",
          enum: ["hierarchical", "mesh", "hierarchical-mesh", "ring", "star", "adaptive"],
          description: 'Swarm topology type. Default: "hierarchical"',
        },
        maxAgents: {
          type: "number",
          description: "Maximum number of agents in the swarm. Default: 8",
        },
        strategy: {
          type: "string",
          enum: ["balanced", "specialized", "adaptive"],
          description: 'Agent strategy. Default: "specialized"',
        },
      },
    },
  },
};

export const TOOL_MEMORY_SEARCH: ChatCompletionTool = {
  type: "function",
  function: {
    name: "memory_search",
    description:
      "Search Ruflo memory for past patterns and learnings. Use before starting complex tasks to leverage past experience.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Semantic search query describing what patterns to find",
        },
        namespace: {
          type: "string",
          description: 'Memory namespace to search in. Default: "patterns"',
        },
      },
      required: ["query"],
    },
  },
};

export const TOOL_MEMORY_STORE: ChatCompletionTool = {
  type: "function",
  function: {
    name: "memory_store",
    description:
      "Store a pattern or learning in Ruflo memory. Use after successful task completion to save what worked.",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Unique key for this memory entry (e.g. pattern-auth-validation)",
        },
        value: {
          type: "string",
          description: "The pattern or learning to store. Be detailed for better future retrieval.",
        },
        namespace: {
          type: "string",
          description: 'Memory namespace. Default: "patterns"',
        },
      },
      required: ["key", "value"],
    },
  },
};

export const TOOL_AGENT_SPAWN: ChatCompletionTool = {
  type: "function",
  function: {
    name: "agent_spawn",
    description:
      "Register a new agent in the Ruflo swarm for coordination tracking.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Agent type (e.g. coder, tester, reviewer, architect)",
        },
        name: {
          type: "string",
          description: "Unique agent name for this swarm session",
        },
      },
      required: ["type", "name"],
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
  TOOL_TRIGGER_VERCEL_DEPLOYMENT,
  TOOL_SWARM_INIT,
  TOOL_MEMORY_SEARCH,
  TOOL_MEMORY_STORE,
  TOOL_AGENT_SPAWN,
];

/** Subsets agents can use — keeps each agent's scope narrow */
export const PM_TOOLS: ChatCompletionTool[] = [
  TOOL_CREATE_TASK,
  TOOL_MEMORY_SEARCH,
];

export const FRONTEND_DEV_TOOLS: ChatCompletionTool[] = [
  TOOL_WRITE_CODE,
  TOOL_CREATE_GITHUB_ISSUE,
  TOOL_CREATE_GITHUB_PR,
  TOOL_UPDATE_TASK_STATUS,
  TOOL_MEMORY_SEARCH,
  TOOL_MEMORY_STORE,
];

export const QA_TOOLS: ChatCompletionTool[] = [
  TOOL_WRITE_CODE,
  TOOL_CREATE_GITHUB_ISSUE,
  TOOL_CREATE_GITHUB_PR,
  TOOL_UPDATE_TASK_STATUS,
  TOOL_MEMORY_SEARCH,
  TOOL_MEMORY_STORE,
];

export const DEVOPS_TOOLS: ChatCompletionTool[] = [
  TOOL_WRITE_CODE,
  TOOL_CREATE_GITHUB_PR,
  TOOL_TRIGGER_VERCEL_DEPLOYMENT,
  TOOL_RUN_LOCAL_COMMAND,
  TOOL_UPDATE_TASK_STATUS,
  TOOL_MEMORY_SEARCH,
];

export const CODER_TOOLS: ChatCompletionTool[] = [
  TOOL_WRITE_CODE,
  TOOL_CREATE_GITHUB_PR,
  TOOL_CREATE_GITHUB_ISSUE,
  TOOL_UPDATE_TASK_STATUS,
  TOOL_MEMORY_SEARCH,
  TOOL_MEMORY_STORE,
];

export const REVIEWER_TOOLS: ChatCompletionTool[] = [
  TOOL_ADD_GITHUB_COMMENT,
  TOOL_CREATE_GITHUB_ISSUE,
  TOOL_UPDATE_TASK_STATUS,
  TOOL_MEMORY_SEARCH,
  TOOL_MEMORY_STORE,
];
