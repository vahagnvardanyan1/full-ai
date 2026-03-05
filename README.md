# AI Team — Multi-Agent Orchestrator

A production-grade **Next.js 15** application that orchestrates a team of AI agents to plan, implement, test, and deploy software — all from a single natural-language request. Built with **OpenAI function calling (GPT-4o)**, **React 19**, **MongoDB**, and real integrations with **GitHub**, **Jira**, and **Vercel**.

## Table of Contents

- [Architecture](#architecture)
- [Agents](#agents)
  - [Product Manager](#1-product-manager)
  - [Frontend Developer](#2-frontend-developer)
  - [QA Agent](#3-qa-agent)
  - [DevOps Agent](#4-devops-agent)
  - [Fashion Stylist](#5-fashion-stylist)
- [Tool System](#tool-system)
- [Integrations](#integrations)
- [UI Overview](#ui-overview)
- [Data Flow](#data-flow)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Security](#security)
- [Key Design Decisions](#key-design-decisions)

---

## Architecture

```
User Request (natural language)
     │
     ▼
┌─────────────────┐
│  Next.js API     │  SSE streaming response
│  Route           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────────┐
│  Orchestrator    │────▶│  OpenAI GPT-4o       │
│  (Planner)       │◀───│  JSON planning step   │
└────────┬────────┘     └──────────────────────┘
         │
         │  Parallel agent dispatch
         │
         ├─── Product Manager ──▶ Task Board + Jira sync
         ├─── Frontend Dev ─────▶ GitHub (branches, commits, PRs)
         ├─── QA Agent ─────────▶ GitHub (test PRs or issues)
         ├─── DevOps Agent ─────▶ Vercel (deployments)
         └─── Fashion Stylist ──▶ Web scraping + DALL-E 3
```

### How It Works

1. The user submits a request in natural language
2. The **Orchestrator** uses GPT-4o to create an execution plan — which agents to involve and in what order
3. Agents are dispatched in **parallel phases** and stream progress via **Server-Sent Events (SSE)**
4. Each agent runs an autonomous multi-stage pipeline, calling tools (GitHub, Jira, Vercel APIs) as needed
5. Results are displayed in a real-time **React Flow pipeline visualization**
6. Workflow runs are persisted to **MongoDB** for history replay

---

## Agents

### 1. Product Manager

**Persona:** Senior PM Director (10+ years experience)

**Pipeline stages:**
1. **Gather Context** — Scans repo structure, tech stack, existing components
2. **Analyze Requirements** — Builds a Product Requirements Document (PRD)
3. **Assess Feasibility** — Calculates complexity (1-5), estimated hours, risks
4. **Plan Tasks** — Decomposes work into 1-6 assignable tasks (hard cap prevents scope creep)
5. **Write User Stories** — Creates "As a / I want / So that" stories with edge cases
6. **Assess Risks** — Identifies technical, scope, dependency, performance, and security risks
7. **Create Tasks** — Creates tasks via the `create_task` tool, auto-synced to Jira

**Tools:** `create_task`

---

### 2. Frontend Developer

**Persona:** Mid-level frontend engineer (3-5 years experience)

**Pipeline stages:**
1. **Onboarding** — Verifies GitHub connection, reads repo context
2. **Planning** — Generates a detailed implementation plan in JSON
3. **Cloning** — Clones the repo to a temp directory
4. **Coding** — Generates complete source code files (zero placeholders)
5. **Self-Review** — Runs type checker and linter; catches issues before push
6. **Auto-Fix** — Single LLM fix pass for common issues
7. **Validation** — Re-runs linter/type-checker
8. **Pushing** — Commits and pushes to a feature branch
9. **PR Creation** — Opens a pull request against main

**Tools:** `write_code`, `create_github_issue`, `create_github_pull_request`, `update_task_status`

**Key behaviors:**
- Always reads `package.json` and `tsconfig.json` first
- Performs blast radius analysis before modifying shared code
- Matches existing codebase patterns (no new paradigms)
- Self-corrects build/lint errors autonomously

---

### 3. QA Agent

**Persona:** Principal QA Engineer (10+ years experience)

**Dual-mode pipeline:**

**Mode A — Automation** (when valuable):
- Writes real, runnable test files (strict no-mock policy)
- Pushes via QA branch (`qa/<frontend-branch>-tests`)
- Opens PR against the frontend feature branch

**Mode B — Issue-Based Verification** (when automation isn't worthwhile):
- Creates a GitHub issue with change analysis, validation results, regression risks, and a manual verification checklist
- Provides a QA recommendation: PASS / CONDITIONAL / FAIL

**Pipeline stages:**
1. Gather context from frontend output
2. Run validation gates (type-check, build, lint, test)
3. Plan strategy (automate or issue-based)
4. Execute QA
5. Generate report

**Tools:** `write_code`, `create_github_issue`, `create_github_pull_request`, `update_task_status`

---

### 4. DevOps Agent

**Persona:** Senior DevOps Engineer

**Capabilities:**
- Generates Dockerfiles, CI/CD configs, environment files
- Triggers Vercel deployments (preview for feature branches, production for main)
- Reports deployment ID, URL, and state

**Tools:** `write_code`, `trigger_vercel_deployment`, `update_task_status`

---

### 5. Fashion Stylist

**Persona:** Senior Fashion Stylist with color theory and trend analysis expertise

**Pipeline stages:**
1. **Parse Preferences** — Validates budget, style, occasion, gender
2. **Scrape Products** — Parallel scraping from Zara, Bershka, Massimo Dutti via retailer JSON APIs
3. **Assemble Outfit** — GPT-4o selects a coherent outfit from the product catalog
4. **Generate Image** — DALL-E 3 visualizes the complete outfit
5. **Complete** — Returns structured recommendation with explanations

**Key features:**
- ScraperAPI proxy support for datacenter IP blocking
- 1-hour in-memory product cache
- Graceful degradation if a retailer fails
- Budget-aware selection with color coordination

---

## Tool System

Tools are defined as OpenAI function-calling schemas and dispatched by a central executor. Each agent has a **scoped tool set** (principle of least privilege).

| Tool | Description | Available To |
|------|-------------|-------------|
| `create_task` | Create internal tasks (task/story/bug) with assignment | PM |
| `update_task_status` | Move tasks through workflow states | FE, QA, DevOps |
| `write_code` | Generate source code files | FE, QA, DevOps |
| `create_github_issue` | Create GitHub issues with labels | FE, QA |
| `create_github_pull_request` | Create PRs with file commits from code store | FE, QA |
| `add_github_comment` | Comment on existing GitHub issues | FE, QA |
| `trigger_vercel_deployment` | Trigger Vercel deployments | DevOps |

### Agent Runner

All agents share a generic runner (`src/lib/agents/runner.ts`) that handles:
- LLM chat completion with GPT-4o
- Automatic tool-calling loop (max 5 rounds to prevent infinite loops)
- Parallel tool execution via `Promise.all`
- Structured error handling and result collection

---

## Integrations

All integrations support **graceful degradation** — when unconfigured, they fall back to simulation mode so the app remains functional.

### GitHub
- **Auth:** Runtime OAuth (popup-based) or environment variables
- **Capabilities:** Create issues, comment on issues, create branches, commit files, open PRs
- **Per-user isolation:** OAuth tokens scoped via device-id cookie

### Jira
- **Auth:** Runtime OAuth or environment variables (email + API token)
- **Capabilities:** Create issues, transition statuses, fetch issues
- **Sync pattern:** In-memory task store is primary; Jira is synced asynchronously (fire-and-forget)

### Vercel
- **Auth:** API token via environment variable
- **Capabilities:** Trigger deployments, check deployment status
- **Targets:** Preview (feature branches) or production (main)

### Integration Management UI
The settings page (`/dashboard/settings/integrations`) provides:
- OAuth connection flow for GitHub and Jira
- Resource selectors (choose repo or project after connecting)
- Connection status tracking
- Grouped display of connected vs available services

---

## UI Overview

### Landing Page (`/`)
- Hero section with animated headline and PixelWorkers animation
- Agent visualization, integration strip, AI providers showcase
- Features section and footer
- Scroll-triggered CTA button

### Dashboard (`/dashboard`)
- **Sidebar** — Collapsible navigation with 5 sections (Dashboard, Agents Marketplace, Team Marketplace, My Workspace, Settings)
- **Agent Pipeline** — React Flow graph visualization showing agent execution phases with real-time status (working, done, error)
- **Detail Panel** — Expandable view of agent outputs including summary, tasks, generated files, tool calls, and outfit recommendations
- **Kanban Board** — Tasks displayed in columns by status (Open, In Progress, Code Review, Testing, Done)
- **Workflow History** — Dropdown panel showing past runs with status indicators and replay capability

### Teams Marketplace (`/dashboard/teams`)
- Filterable grid of team templates
- Category filtering (IT, Design, Marketing, Consulting)
- Team detail pages with pricing tiers and agent rosters

### Color System
| Agent | Color |
|-------|-------|
| Product Manager | `#a78bfa` (purple) |
| Frontend Developer | `#34d399` (green) |
| QA | `#facc15` (yellow) |
| DevOps | `#f97316` (orange) |
| Fashion Stylist | `#ec4899` (pink) |

---

## Data Flow

```
User Request
    |
    v
Orchestrator (GPT-4o plans agent sequence)
    |
    v
Product Manager (creates tasks) --> Task Store --> Jira (async sync)
    |
    v
Frontend Developer (writes code) --> Code Store --> GitHub (branch + PR)
    |
    v
QA Agent (tests/verifies) --> GitHub (test PR or issue)
    |
    v
DevOps Agent (deploys) --> Vercel (preview/production)
    |
    v
SSE stream --> React UI (real-time pipeline visualization)
    |
    v
MongoDB (workflow persistence for history replay)
```

### Stores

| Store | Type | Purpose |
|-------|------|---------|
| **Task Store** | In-memory (per-request) | Tasks created by PM, status updates by other agents |
| **Code Store** | In-memory (per-request) | Generated code files, consumed by GitHub PR creation |
| **Session Store** | MongoDB + in-memory fallback | Conversation history (last 20 messages, 30min TTL) |
| **Integration Store** | Per-device | OAuth tokens for GitHub/Jira (scoped via device-id cookie) |

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd ai-team
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials (see [Environment Variables](#environment-variables) below).

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

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o and DALL-E 3 |

### Persistence (recommended)

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string; enables workflow history and session persistence |

### OAuth Integrations (optional)

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `JIRA_CLIENT_ID` | Jira OAuth app client ID |
| `JIRA_CLIENT_SECRET` | Jira OAuth app client secret |
| `NEXT_PUBLIC_APP_URL` | Base URL for OAuth callbacks (default: `http://localhost:3000`) |

### Vercel Deployments (optional)

| Variable | Description |
|----------|-------------|
| `VERCEL_TOKEN` | Vercel API token |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `VERCEL_TEAM_ID` | Vercel team ID (optional, for team accounts) |

### Fashion Stylist (optional)

| Variable | Description |
|----------|-------------|
| `SCRAPPER_API_KEY` | ScraperAPI key for proxy routing (needed on Vercel to bypass retailer IP blocking) |

### Legacy Jira (optional, fallback to OAuth)

| Variable | Description |
|----------|-------------|
| `JIRA_BASE_URL` | Jira instance URL |
| `JIRA_EMAIL` | Jira account email |
| `JIRA_API_TOKEN` | Jira API token |
| `JIRA_PROJECT_KEY` | Jira project key |

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                        Root layout (fonts, theme, error boundary)
│   ├── page.tsx                          Landing page
│   ├── app/page.tsx                      Redirect to /dashboard
│   ├── api/
│   │   ├── workflows/route.ts            GET workflow history & replay
│   │   ├── auth/jira/route.ts            Jira OAuth callback
│   │   └── integrations/                 GitHub/Jira status & resource APIs
│   └── dashboard/
│       ├── layout.tsx                    Dashboard shell (sidebar + content)
│       ├── teams/page.tsx               Teams marketplace
│       ├── teams/[teamId]/page.tsx       Team detail
│       └── settings/integrations/page.tsx Integration management
│
├── components/
│   ├── agent-pipeline.tsx               React Flow workflow visualization
│   ├── detail-panel.tsx                 Agent output detail view
│   ├── kanban-board.tsx                 Task kanban board
│   ├── task-board.tsx                   Compact inline task list
│   ├── code-viewer.tsx                  Generated code file viewer
│   ├── workflow-history-panel.tsx       Past run history & replay
│   ├── dashboard/
│   │   ├── sidebar.tsx                  Collapsible navigation sidebar
│   │   ├── dashboard-shell.tsx          Layout container
│   │   ├── selector-modal.tsx           Resource selector (repos/projects)
│   │   └── integration-card.tsx         Service connection card
│   ├── landing/
│   │   ├── hero-section.tsx             Animated hero
│   │   ├── agent-visualization.tsx      Agent showcase
│   │   ├── features-section.tsx         Feature highlights
│   │   └── ...                          Other landing components
│   └── ui/                             Radix-based primitives (button, badge, etc.)
│
├── hooks/
│   └── use-run-polling.ts              Polling fallback for SSE reconnection
│
├── lib/
│   ├── agents/
│   │   ├── runner.ts                   Generic agent runner (tool-calling loop)
│   │   ├── product-manager/            PM agent (8-stage pipeline)
│   │   │   ├── index.ts
│   │   │   ├── system-prompt.ts
│   │   │   ├── types/index.ts
│   │   │   └── services/               Context, OpenAI services
│   │   ├── frontend-developer/         FE agent (9-stage pipeline)
│   │   │   ├── index.ts
│   │   │   ├── system-prompt.ts
│   │   │   ├── types/index.ts
│   │   │   └── services/               GitHub, OpenAI, validator, impact analyzer
│   │   ├── qa/                         QA agent (dual-mode pipeline)
│   │   │   ├── index.ts
│   │   │   ├── system-prompt.ts
│   │   │   ├── types/index.ts
│   │   │   └── services/               Context, strategy, validator, report
│   │   ├── devops/                     DevOps agent
│   │   │   ├── index.ts
│   │   │   ├── system-prompt.ts
│   │   │   └── types/index.ts
│   │   └── fashion-stylist/            Fashion agent
│   │       ├── system-prompt.ts
│   │       ├── types/index.ts
│   │       └── services/               Scraper, OpenAI services
│   │
│   ├── clients/
│   │   ├── openai.ts                   OpenAI singleton
│   │   ├── github.ts                   GitHub REST API (Octokit)
│   │   ├── jira.ts                     Jira Cloud REST API
│   │   ├── jira-sync.ts               Fire-and-forget task-to-Jira bridge
│   │   ├── vercel.ts                   Vercel deployment API
│   │   ├── tasks.ts                    In-memory task store (per-request)
│   │   └── code-store.ts              In-memory code file store (per-request)
│   │
│   ├── tools/
│   │   ├── definitions.ts             OpenAI function-calling schemas
│   │   └── executor.ts                Tool name -> handler dispatcher
│   │
│   ├── db/
│   │   ├── connection.ts              MongoDB singleton with hot-reload caching
│   │   └── models/session.ts          Mongoose session schema
│   │
│   ├── dashboard/
│   │   ├── types.ts                   Dashboard TypeScript interfaces
│   │   └── constants.ts              Navigation items and categories
│   │
│   ├── logger.ts                      Structured JSON logger
│   ├── session-store.ts               Session storage (MongoDB + memory fallback)
│   ├── request-context.ts             AsyncLocalStorage for per-request device ID
│   ├── workflow-replay.ts             Reconstruct UI state from stored SSE events
│   └── styles.ts                      Shared style constants
│
└── middleware.ts                       Device-id cookie for multi-user isolation
```

---

## Security

- **Server-side secrets** — All API tokens are environment variables, never bundled into client JavaScript
- **Input validation** — Rejects empty or oversized messages
- **Least privilege** — Each agent has a scoped tool set; PM can only create tasks, DevOps can only deploy, etc.
- **Session bounds** — 20-message limit per session, 30-minute TTL
- **Multi-user isolation** — Device-id cookies scope OAuth tokens per browser/user
- **OAuth flows** — Popup-based OAuth for GitHub and Jira; tokens stored server-side

---

## Key Design Decisions

- **Autonomous pipelines** — Each agent runs a deterministic multi-stage pipeline to completion with minimal human intervention
- **OpenAI function calling** — Agents use structured tool definitions; the model decides when and how to call external APIs
- **SSE streaming** — Real-time progress updates streamed to the UI during agent execution
- **Parallel execution** — The orchestrator dispatches agents concurrently by phase for speed
- **Graceful degradation** — All external APIs (GitHub, Vercel, Jira) fall back to simulation when unconfigured
- **Fire-and-forget sync** — Jira sync is non-blocking; failures are logged but never break the pipeline
- **Per-request stores** — Tasks and code files are scoped to request ID, preventing cross-request leakage
- **Workflow replay** — SSE events persisted to MongoDB allow full reconstruction of past runs in the UI
- **In-memory primary** — Task and code stores are in-memory for speed; external systems (Jira, GitHub) are secondary
