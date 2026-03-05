# Full-AI Agent Guide

> **For Cursor / Codex CLI** — Ruflo-powered orchestration
> Skills: `.agents/skills/` | Config: `.agents/config.toml`

---

## TL;DR

```
1. Ruflo MCP = COORDINATOR (tracks state, stores memory, coordinates swarms)
2. OpenAI GPT-4o = PLANNER (decides which agents, in what phases)
3. Agent Runners = EXECUTORS (write code, create PRs, run tests)
4. ALWAYS search memory BEFORE starting: memorySearch({ query: "task" })
5. ALWAYS store patterns AFTER success: memoryStore({ key, value, namespace })
```

## Orchestration Flow

```
User Request
    ↓
Memory Search (learn from past patterns)
    ↓
Complexity Detection (hookRoute → routing code)
    ↓
Swarm Init (topology based on complexity)
    ↓
GPT-4o Planner (decides agents & phases)
    ↓
Phase Execution (sequential phases, parallel agents)
  ├─ Pre-task hooks
  ├─ Agent runs (OpenAI function calling)
  └─ Post-task hooks (neural learning)
    ↓
Memory Store (save patterns for future)
    ↓
SSE Events → Dashboard
```

## Agent Types

### Pipeline Agents (Existing)

| Agent | Role | Runner |
|-------|------|--------|
| `product_manager` | Analyzes requests, creates tasks | Specialized v3 pipeline |
| `frontend_developer` | Writes code, opens PRs | Specialized v4 pipeline |
| `qa` | Writes tests, validates | Specialized pipeline |
| `devops` | CI/CD, deployments | Specialized pipeline |

### Ruflo Agents (New)

| Agent | Role | Runner |
|-------|------|--------|
| `researcher` | Analyzes requirements, finds patterns | Generic (loads .claude/agents/core/researcher.md) |
| `architect` | System design, architecture decisions | Generic (loads .claude/agents/core/planner.md) |
| `coder` | Code implementation | Generic (loads .claude/agents/core/coder.md) |
| `reviewer` | Code review, quality checks | Generic (loads .claude/agents/core/reviewer.md) |
| `tester` | Test writing, coverage | Generic (loads .claude/agents/core/tester.md) |
| `security_architect` | Security design, threat modeling | Generic (loads .claude/agents/v3/) |
| `performance_engineer` | Optimization, profiling | Generic (loads .claude/agents/v3/) |
| `coordinator` | Swarm coordination | Generic (loads .claude/agents/swarm/) |

## Tools Available to Agents

### Existing Tools
- `create_task` — Create internal tasks
- `write_code` — Generate source code files
- `create_github_issue` — Create GitHub issues
- `add_github_comment` — Comment on issues
- `create_github_pull_request` — Open PRs
- `update_task_status` — Move tasks through workflow
- `trigger_vercel_deployment` — Deploy to Vercel

### MCP Proxy Tools (New)
- `swarm_init` — Initialize swarm topology via Ruflo
- `memory_search` — Semantic search for patterns
- `memory_store` — Store successful patterns
- `agent_spawn` — Register agent in swarm

## Skills

### Codex Skills (`.codex/skills/`)
- `plan-work` — Structured planning before implementation
- `coding-guidelines-verify` — Verify changes against rules

### Ruflo Skills (`.agents/skills/`)
134 skills covering:
- **Swarm**: orchestration, coordination, memory management
- **GitHub**: PR management, code review, release management
- **Security**: audit, threat modeling, CVE scanning
- **Performance**: optimization, benchmarking, profiling
- **SPARC**: specification, architecture, pseudocode, refinement
- **Neural**: training, pattern learning, SONA

## MCP Integration

The Ruflo MCP server provides coordination tools:

| Tool Category | Tools | Purpose |
|---------------|-------|---------|
| **Swarm** | `swarm_init`, `swarm_status`, `agent_spawn` | Multi-agent coordination |
| **Memory** | `memory_search`, `memory_store`, `memory_retrieve` | Pattern learning |
| **Hooks** | `hook_pre_task`, `hook_post_task`, `hook_route` | Lifecycle management |
| **Neural** | `neural_train`, `neural_status` | Pattern training |

## Behavioral Rules

- Agents execute tasks; Ruflo MCP only coordinates
- Each agent has a focused tool set (narrow scope)
- Phases run sequentially; agents within phases run in parallel
- Pre/post task hooks fire automatically for learning
- Memory search happens before every orchestration run
- All SSE events are persisted to MongoDB for replay

## File Organization

| Directory | Purpose |
|-----------|---------|
| `src/lib/agents/product-manager/` | PM agent runner |
| `src/lib/agents/frontend-developer/` | Frontend dev runner |
| `src/lib/agents/qa/` | QA agent runner |
| `src/lib/agents/devops/` | DevOps agent runner |
| `src/lib/agents/runner.ts` | Generic agent runner (for Ruflo agents) |
| `src/lib/mcp/` | MCP client, types, tool wrappers |
| `src/lib/orchestrator.ts` | Central orchestrator |
| `.claude/agents/` | Agent definitions (markdown) |
| `.agents/skills/` | Skill files (SKILL.md) |
