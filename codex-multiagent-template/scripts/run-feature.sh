#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FEATURE_REQUEST="${1:-Implement the requested feature using product_manager, frontend_developer, qa, and devops roles.}"

PROMPT="$(cat <<EOF
${FEATURE_REQUEST}

Use role phases:
Phase 1: product_manager
Phase 2: frontend_developer
Phase 3 in parallel: qa and devops

Wait for all outputs and provide:
1) Final implementation summary
2) Validation and test status
3) Deployment readiness
4) Remaining risks and follow-up actions
EOF
)"

cd "${ROOT_DIR}"
codex exec "${PROMPT}"
