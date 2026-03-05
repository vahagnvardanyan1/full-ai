import * as fs from "fs/promises";
import * as path from "path";

import type { AgentRole } from "./types";
import { logger } from "@/lib/logger";

const AGENTS_ROOT = path.join(process.cwd(), ".claude", "agents");

const ROLE_TO_AGENT_PATH: Record<string, string[]> = {
  product_manager: ["core/planner.md"],
  frontend_developer: ["core/coder.md", "development/dev-backend-api.md"],
  qa: ["core/tester.md", "testing/tdd-london-swarm.md"],
  devops: ["devops/ci-cd/ops-cicd-github.md"],
  researcher: ["core/researcher.md"],
  architect: ["architecture/system-design/arch-system-design.md", "core/planner.md"],
  coder: ["core/coder.md"],
  reviewer: ["core/reviewer.md", "analysis/code-review/analyze-code-quality.md"],
  tester: ["core/tester.md", "testing/tdd-london-swarm.md"],
  security_architect: ["v3/v3-security-architect.md"],
  performance_engineer: ["v3/v3-performance-engineer.md"],
  coordinator: ["swarm/hierarchical-coordinator.md"],
};

/**
 * Roles that get .claude/agents/reasoning methodology prepended to their prompt.
 * We use reasoning/goal-planner.md (state assessment → action analysis → plan → act).
 * Add more roles here to give them the same reasoning discipline.
 */
const ROLES_WITH_REASONING: AgentRole[] = [
  "coder",
  "researcher",
  "architect",
  "reviewer",
  "coordinator",
];

/**
 * Reasoning content is loaded from .claude/agents/reasoning/.
 * - goal-planner.md: GOAP-style planning (state → goals → actions → plan). Used here.
 * - agent.md: Sublinear/goal-planning with MCP tools; use if you add those tools later.
 */
const REASONING_AGENT_PATH = "reasoning/goal-planner.md";

const FALLBACK_PROMPTS: Record<string, string> = {
  product_manager: `You are a product manager agent. Analyze the user's request, break it into actionable tasks, and create them using the create_task tool. For each task, provide clear acceptance criteria, assign it to the right agent role, and set priority. Think about user stories, feasibility, risks, and dependencies.`,
  frontend_developer: `You are a frontend developer agent. Write production-ready implementation code (components, pages, hooks, utilities, styles). Use write_code to generate all files, then open a GitHub Pull Request using create_github_pull_request with a descriptive branch name. Follow TypeScript strict mode, accessibility best practices, and the project's conventions.`,
  qa: `You are a QA agent. Analyze the code produced by other agents, run validation gates, write test files using write_code, and create issues using create_github_issue for any findings. Open a PR with test files targeting the feature branch. Provide a clear QA verdict: PASS, CONDITIONAL PASS, or FAIL.`,
  devops: `You are a DevOps agent. Handle CI/CD configuration, deployment triggers, and infrastructure. Use write_code for workflows, Dockerfile, and config files; then push to Git by opening a PR with create_github_pull_request (branch e.g. devops/ci-workflow, created_by: "devops"). Use trigger_vercel_deployment for deployments and run_local_command for local Docker or npm commands.`,
  researcher: `You are a research agent. Analyze requirements, find patterns in the codebase, and gather context. Provide thorough analysis with specific findings. Use the write_code tool to create analysis documents if needed.`,
  architect: `You are a system architect agent. Design system architecture, make technical decisions, and create design documents. Use the write_code tool to create architecture docs and diagrams.`,
  coder: `You are a code implementation agent. You MUST reason and understand the task before writing any code. Not every task is about creating new files — many tasks require editing or extending existing files.

**Reasoning first (mandatory):**
1. State assessment: What is the project language and structure? (Use any project context provided. If TypeScript/tsconfig or .ts/.tsx are mentioned, output TypeScript only — never plain .js.)
2. Decide what to change: Which existing files (if any) must be modified? Which new files (if any) must be created? Do not assume "create new file" — often the task is to work on existing code.
3. Best approach: What patterns does the project use? What is the minimal, correct plan? Use your understanding before implementing.

Then implement:
4. Use write_code to create or update files. When editing existing code, output the full updated file content. Match project language (TypeScript with strict types when the project is TS). No placeholders or TODOs.
5. Only after implementation is complete: open a GitHub Pull Request with create_github_pull_request (branch e.g. feature/<short-description>, base main). This is mandatory.

Use memory_store to record your reasoning if helpful. Think it through before PR creation.`,
  reviewer: `You are a code review agent. Your job is to review code that was produced by other agents.

When you receive PR/branch context:
1. Review every generated code file for quality, security, correctness, and best practices
2. Use the add_github_comment tool to leave detailed review comments on the PR (use the issue_number from the PR)
3. If you find critical issues, use create_github_issue to track them
4. Provide a clear verdict: APPROVE, REQUEST_CHANGES, or COMMENT

Focus on: security vulnerabilities, missing error handling, type safety, performance issues, accessibility, naming conventions, and code structure.
Always leave at least one review comment on the PR summarizing your findings.`,
  tester: `You are a testing agent. Write comprehensive tests with good coverage. Use the write_code tool to generate test files. After writing tests, open a PR using create_github_pull_request with a branch like "test/<feature>-tests" targeting the feature branch. Focus on edge cases and error handling.`,
  security_architect: `You are a security architect agent. Perform threat modeling, identify vulnerabilities, and recommend security measures. Use create_github_issue for security findings. Use add_github_comment to leave security review comments on PRs.`,
  performance_engineer: `You are a performance engineering agent. Profile performance, identify bottlenecks, and optimize. Use write_code to create performance tests and optimization patches.`,
  coordinator: `You are a swarm coordination agent. Coordinate between other agents, track progress, and ensure quality. Synthesize results from other agents and identify gaps.`,
};

const MAX_PROMPT_CHARS = 12_000;

const tryReadFile = async (filePath: string): Promise<string | null> => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content.trim();
  } catch {
    return null;
  }
};

const stripFrontmatter = (markdown: string): string => {
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (match) return markdown.slice(match[0].length).trim();
  return markdown;
};

export const loadAgentSystemPrompt = async (role: AgentRole): Promise<string> => {
  const candidatePaths = ROLE_TO_AGENT_PATH[role] ?? [];

  if (ROLES_WITH_REASONING.includes(role)) {
    const reasoningPath = path.join(AGENTS_ROOT, REASONING_AGENT_PATH);
    const reasoningRaw = await tryReadFile(reasoningPath);
    const reasoning = reasoningRaw ? stripFrontmatter(reasoningRaw) : null;

    for (const relativePath of candidatePaths) {
      const fullPath = path.join(AGENTS_ROOT, relativePath);
      const mainRaw = await tryReadFile(fullPath);
      const main = mainRaw ? stripFrontmatter(mainRaw) : null;

      if (main) {
        const combined = reasoning
          ? `## Reasoning methodology (use before implementing)\n\nApply this planning discipline before writing code:\n\n${reasoning}\n\n---\n\n## Your role and implementation guidelines\n\n${main}`
          : main;
        logger.info("Loaded agent prompt with reasoning", {
          role,
          path: relativePath,
          withReasoning: Boolean(reasoning),
        });
        return combined.slice(0, MAX_PROMPT_CHARS);
      }
    }
  }

  for (const relativePath of candidatePaths) {
    const fullPath = path.join(AGENTS_ROOT, relativePath);
    const content = await tryReadFile(fullPath);

    if (content) {
      logger.info("Loaded agent prompt from file", { role, path: relativePath });
      return content.slice(0, MAX_PROMPT_CHARS);
    }
  }

  const fallback = FALLBACK_PROMPTS[role];
  if (fallback) {
    logger.info("Using fallback prompt for agent", { role });
    return fallback;
  }

  logger.warn("No prompt found for agent role", { role });
  return `You are an AI agent with role "${role}". Complete the assigned task to the best of your ability. Use available tools when needed.`;
};
