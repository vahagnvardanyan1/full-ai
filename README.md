# AI Team — Multi-Agent Orchestrator

A production-grade Next.js 15 application that simulates an AI software team with four specialized agents orchestrated by OpenAI function calling.

## Architecture


```
User Request
     │
     ▼
┌─────────────┐
│  Next.js API │  POST /api/orchestrate
│    Route     │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────────────┐
│ Orchestrator │────▶│  OpenAI (gpt-4o)     │
│   (Planner)  │◀───│  JSON planning step   │
└──────┬──────┘     └──────────────────────┘
       │
       ├─── Product Manager ──▶ Task Board (create & assign tasks)
       ├─── Frontend Dev ─────▶ GitHub API (create issues/PRs)
       ├─── QA Agent ─────────▶ GitHub API (add checklists)
       └─── DevOps Agent ─────▶ Vercel API (trigger deployments)
```

### Agents

| Agent | Role | Tools |
|-------|------|-------|
| Product Manager | Analyzes requests, breaks into subtasks | `create_task` |
| Frontend Developer | Creates implementation plans | `create_github_issue`, `create_github_pull_request` |
| QA | Generates test cases | `add_github_comment`, `create_github_issue` |
| DevOps | Triggers deployments | `trigger_vercel_deployment` |

### Key Design Decisions

- **OpenAI function calling** — agents use structured tool definitions; the model decides when and how to call external APIs.
- **In-app task board** — the PM creates tasks and assigns them to agents; tasks render in the UI with color-coded cards per agent.
- **Parallel execution** — the orchestrator dispatches agents concurrently for speed.
- **Session state** — in-memory store maintains conversation context across requests (swap for Redis in production).
- **Server-side only** — all API keys stay on the server; nothing is exposed to the browser.

## Setup

### 1. Clone and install

```bash
cd ai-team
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your credentials:

| Variable | Where to get it |
|----------|----------------|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `GITHUB_TOKEN` | https://github.com/settings/tokens — needs `repo` scope |
| `GITHUB_OWNER` | Your GitHub org or username |
| `GITHUB_REPO` | Target repository name |
| `VERCEL_TOKEN` | https://vercel.com/account/tokens |
| `VERCEL_PROJECT_ID` | Project settings in Vercel dashboard |
| `VERCEL_TEAM_ID` | Optional — for team accounts |

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:3000

### 4. Build for production

```bash
npm run build
npm start
```

## Security

- All API tokens are server-side environment variables — never bundled into client JavaScript.
- Input validation rejects empty or oversized messages.
- Each agent has a scoped tool set (principle of least privilege).
- Session store bounds memory with TTL and message limits.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              Root layout
│   ├── page.tsx                Main UI (client component)
│   ├── globals.css             Global styles
│   └── api/orchestrate/
│       └── route.ts            POST handler
├── components/
│   ├── chat-input.tsx          Message input with keyboard shortcut
│   ├── agent-response.tsx      Agent result card with tool call display
│   ├── task-board.tsx          Task board with color-coded agent cards
│   └── loading-spinner.tsx     Loading indicator
└── lib/
    ├── orchestrator.ts         Central coordinator
    ├── logger.ts               Structured JSON logger
    ├── session-store.ts        In-memory conversation state
    ├── agents/
    │   ├── types.ts            Shared TypeScript types
    │   ├── runner.ts           Generic agent runner with tool loop
    │   ├── product-manager.ts  PM agent
    │   ├── frontend-developer.ts  Dev agent
    │   ├── qa-agent.ts         QA agent
    │   └── devops-agent.ts     DevOps agent
    ├── clients/
    │   ├── openai.ts           OpenAI singleton
    │   ├── github.ts           Octokit wrapper
    │   ├── tasks.ts            In-memory task store
    │   └── vercel.ts           Vercel deployment API
    └── tools/
        ├── definitions.ts      OpenAI tool schemas
        └── executor.ts         Tool dispatcher
```
