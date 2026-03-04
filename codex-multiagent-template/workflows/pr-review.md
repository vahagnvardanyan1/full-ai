# PR Review Workflow

## Purpose
Run a codex-native, role-based multi-agent review against current branch changes.

## Role Sequence
1. `product_manager` defines review scope and acceptance criteria.
2. `frontend_developer` performs implementation-level review and highlights patch opportunities.
3. `qa` evaluates correctness, regressions, and missing tests.
4. `devops` evaluates CI/CD, deploy risk, and rollback readiness.

## Parallelization Rule
- Run `qa` and `devops` in parallel after `frontend_developer` output is available.

## Suggested Parent Prompt
Use this in Codex:

```
Review this branch against main using roles:
1) product_manager for scope and acceptance criteria
2) frontend_developer for code-level findings
3) qa and devops in parallel for validation and release risk

Wait for all agents and return a consolidated report with sections:
- Scope
- Findings by severity
- Test gaps
- Deployment risks
- Final recommendation
```

## Monitoring Notes
- For long-running checks, explicitly ask parent flow to use monitor-style polling behavior:
  - short waits
  - periodic status checks
  - timeout and failure summary
