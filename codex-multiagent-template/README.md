# Codex Native Multi-Agent Template

This is a greenfield project scaffold designed to mirror Codex multi-agent patterns with your role naming:
- `product_manager`
- `frontend_developer`
- `qa`
- `devops`

## What This Includes
- Declarative role configuration in `.codex/config.toml`
- Role-specific config files in `agents/`
- Reusable skill-like prompt contracts in `prompts/`
- Workflow playbooks in `workflows/`
- Execution helpers in `scripts/`

## Project Layout
- `.codex/config.toml`: root multi-agent settings and role registration
- `agents/*.toml`: per-role model, sandbox, and instruction policy
- `prompts/*.md`: reusable role prompt packs
- `workflows/*.md`: suggested parent prompts and handoff model
- `scripts/*.sh`: convenience wrappers around `codex exec`

## Quick Start
1. Ensure Codex CLI is installed and available on your PATH.
2. Ensure Codex multi-agent support is enabled in your environment.
3. Run:

```bash
bash scripts/bootstrap.sh
```

4. Run a review workflow:

```bash
bash scripts/run-pr-review.sh
```

5. Run a feature workflow:

```bash
bash scripts/run-feature.sh "Add X with Y constraints"
```

## Role Execution Model
Recommended phase order:
1. `product_manager`
2. `frontend_developer`
3. `qa` + `devops` in parallel

## Parity Notes vs Official Multi-Agent Docs
This template aligns with official principles:
- declarative roles
- parallelizable phase design
- parent aggregation workflow
- long-running monitoring guidance in workflow docs

Reference:
- [OpenAI Codex Multi-agents](https://developers.openai.com/codex/multi-agent)

## Troubleshooting
- `codex: command not found`: install and expose Codex CLI in PATH.
- Agent role config errors: verify `.codex/config.toml` paths point to existing files.
- No parallel behavior observed: explicitly request phase-based parallel execution in the parent prompt.
