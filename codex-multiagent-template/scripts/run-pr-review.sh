#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PROMPT="$(cat <<'EOF'
Review this branch against main using role phases:
Phase 1: product_manager defines scope and acceptance criteria.
Phase 2: frontend_developer performs implementation-level review.
Phase 3 in parallel: qa and devops evaluate test and release risk.

Wait for all role outputs and return:
1) Scope and assumptions
2) Findings by severity
3) Missing tests and test plan
4) Deployment and rollback risk
5) Final go/no-go recommendation
EOF
)"

cd "${ROOT_DIR}"
codex exec "${PROMPT}"
