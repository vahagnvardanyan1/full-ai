# Feature Delivery Workflow

## Purpose
Deliver a feature with codex-native multi-agent role handoff.

## Phase Model
1. **Phase 1**: `product_manager`
   - Break down scope, dependencies, and acceptance criteria.
2. **Phase 2**: `frontend_developer`
   - Implement minimal, complete patch.
3. **Phase 3 (Parallel)**: `qa` + `devops`
   - `qa`: regression and test validation
   - `devops`: CI/CD and deployment readiness

## Suggested Parent Prompt
Use this in Codex:

```
Implement this feature using role phases:
Phase 1: product_manager
Phase 2: frontend_developer
Phase 3 in parallel: qa and devops

Collect all outputs and return:
1) What changed
2) Validation status
3) Deployment readiness
4) Remaining risks and next actions
```

## Aggregation Contract
- Parent response must include:
  - final scope confirmation
  - file-level implementation summary
  - QA findings and test plan
  - DevOps release decision with rollback notes
