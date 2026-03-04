#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Bootstrapping codex-native multi-agent template..."
echo "Project root: ${ROOT_DIR}"

if ! command -v codex >/dev/null 2>&1; then
  echo "Error: codex CLI not found in PATH."
  echo "Install and configure Codex CLI first, then rerun."
  exit 1
fi

echo "Validating required files..."
required_files=(
  "${ROOT_DIR}/.codex/config.toml"
  "${ROOT_DIR}/agents/product_manager.toml"
  "${ROOT_DIR}/agents/frontend_developer.toml"
  "${ROOT_DIR}/agents/qa.toml"
  "${ROOT_DIR}/agents/devops.toml"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "${file}" ]]; then
    echo "Missing required file: ${file}"
    exit 1
  fi
done

echo "Bootstrap complete."
echo "Next steps:"
echo "1) Open this folder in Codex-aware environment."
echo "2) Ensure multi-agent feature is enabled in Codex."
echo "3) Run scripts/run-pr-review.sh or scripts/run-feature.sh."
