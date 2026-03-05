# Full-AI — Ruflo-Powered Agent Orchestration

> **Ruflo v3.5** integrated into a Next.js 15 dashboard with 60+ AI agents,
> 134 skills, swarm coordination, memory/learning, and GitHub/Jira/Vercel integrations.
> MCP Server: `npx -y @claude-flow/cli@latest mcp start`

## Behavioral Rules (Always Enforced)

- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files unless explicitly requested
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files

## File Organization

- Use `/src` for source code files
- Use `/src/lib/agents/` for agent runner logic
- Use `/src/lib/mcp/` for MCP client and tools
- Use `/src/lib/tools/` for OpenAI function-calling tool definitions
- Use `/src/lib/clients/` for external API clients (GitHub, Jira, Vercel)
- Use `/scripts` for utility scripts
- Use `/.claude/agents/` for agent definition markdown files
- Use `/.agents/skills/` for skill SKILL.md files
- Use `/.codex/skills/` for Codex skill files

## Project Architecture

This project is a Next.js 15 application with a Ruflo-powered multi-agent orchestration backend.

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/app/` | Next.js pages and API routes |
| `src/app/api/orchestrate/` | Main orchestration SSE endpoint |
| `src/app/api/auth/` | GitHub and Jira OAuth flows |
| `src/app/api/integrations/` | Integration status and data endpoints |
| `src/app/api/mcp/` | MCP server status endpoint |
| `src/lib/orchestrator.ts` | Central orchestrator with Ruflo MCP integration |
| `src/lib/mcp/` | MCP client, types, and tool wrappers |
| `src/lib/agents/` | Agent runners (PM, Frontend Dev, QA, DevOps, + Ruflo agents) |
| `src/lib/tools/` | OpenAI function-calling tool definitions and executor |
| `src/lib/clients/` | GitHub, Jira, Vercel, OpenAI, MongoDB clients |
| `.claude/agents/` | 98 Ruflo agent definitions |
| `.agents/skills/` | 134 Ruflo skill files |
| `.claude/helpers/` | Hook handlers and utility scripts |
| `.claude/commands/` | SPARC, swarm, GitHub, monitoring commands |

## Concurrency: 1 MESSAGE = ALL RELATED OPERATIONS

- All operations MUST be concurrent/parallel in a single message
- ALWAYS batch ALL file reads/writes/edits in ONE message
- ALWAYS batch ALL terminal operations in ONE message

## Swarm Orchestration

The orchestrator uses Ruflo MCP tools for swarm coordination:

1. **Memory search** before planning (learn from past patterns)
2. **Complexity detection** via `hookRoute` to determine agent needs
3. **Swarm init** with appropriate topology
4. **Phase execution** with pre/post task hooks
5. **Memory store** after completion for future learning

### Agent Routing (Complexity Detection)

| Code | Task | Agents |
|------|------|--------|
| 1 | Bug Fix | coordinator, researcher, coder, tester |
| 3 | Feature | coordinator, architect, coder, tester, reviewer |
| 5 | Refactor | coordinator, architect, coder, reviewer |
| 7 | Performance | coordinator, perf-engineer, coder |
| 9 | Security | coordinator, security-architect, auditor |

### Task Complexity Detection

**AUTO-INVOKE SWARM when task involves:**
- Multiple files (3+)
- New feature implementation
- Refactoring across modules
- API changes with tests
- Security-related changes

**SKIP SWARM for:**
- Single file edits
- Simple bug fixes (1-2 lines)
- Documentation updates
- Configuration changes

## Available Agents (60+ Types)

### Core Development
`coder`, `reviewer`, `tester`, `planner`, `researcher`

### Existing Pipeline Agents
`product_manager`, `frontend_developer`, `qa`, `devops`

### Specialized Agents
`security-architect`, `security-auditor`, `memory-specialist`, `performance-engineer`

### Swarm Coordination
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`

### GitHub & Repository
`pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`, `workflow-automation`

### SPARC Methodology
`specification`, `architecture`, `pseudocode`, `refinement`

## Preserved Integrations

These flows must NOT be modified:
- GitHub OAuth (`/api/auth/github/*`)
- Jira OAuth (`/api/auth/jira/*`)
- Integration status endpoints (`/api/integrations/*`)
- Vercel deployment triggers
- MongoDB workflow persistence
- SSE streaming contract

## MCP Configuration

MCP server config lives in `.mcp.json`. The server is accessed via:
```bash
npx -y @claude-flow/cli@latest mcp start
```

Environment:
- `CLAUDE_FLOW_MODE=v3`
- `CLAUDE_FLOW_TOPOLOGY=hierarchical-mesh`
- `CLAUDE_FLOW_MAX_AGENTS=15`
- `CLAUDE_FLOW_MEMORY_BACKEND=hybrid`

## Environment Variables

```bash
# App
MONGODB_URI=...
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# GitHub OAuth
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Jira OAuth
JIRA_CLIENT_ID=...
JIRA_CLIENT_SECRET=...

# Vercel
VERCEL_TOKEN=...
VERCEL_PROJECT_ID=...
VERCEL_TEAM_ID=...
```
