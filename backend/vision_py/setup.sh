#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VENV_DIR="${VISION_VENV_DIR:-/tmp/vision-venv}"
REQUIREMENTS_FILE="$ROOT_DIR/backend/vision_py/requirements.txt"
UV_CACHE_DIR="${UV_CACHE_DIR:-/tmp/uv-cache}"
export UV_CACHE_DIR

if command -v uv >/dev/null 2>&1; then
  uv python install 3.11 >/dev/null
  uv venv --python 3.11 "$VENV_DIR"
  uv pip install --python "$VENV_DIR/bin/python" -r "$REQUIREMENTS_FILE"
else
  PYTHON_BIN="${VISION_BOOTSTRAP_PYTHON:-python3}"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install --upgrade pip
  "$VENV_DIR/bin/pip" install -r "$REQUIREMENTS_FILE"
fi

echo "Vision environment ready: $VENV_DIR"
echo "Export VISION_PYTHON=$VENV_DIR/bin/python if you want to pin this interpreter explicitly."
