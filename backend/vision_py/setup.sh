#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VENV_DIR="${VISION_VENV_DIR:-/tmp/vision-venv}"
REQUIREMENTS_FILE="$ROOT_DIR/backend/vision_py/requirements.txt"

# Sistem Python'unu bul
PYTHON_BIN="${VISION_BOOTSTRAP_PYTHON:-}"
if [ -z "$PYTHON_BIN" ]; then
  for candidate in python3.11 python3.12 python3.10 python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
      PYTHON_BIN="$candidate"
      break
    fi
  done
fi

if [ -z "$PYTHON_BIN" ]; then
  # uv ile Python bul (kurulum yapmadan)
  if command -v uv >/dev/null 2>&1; then
    PYTHON_BIN="$(uv python find 3.11 2>/dev/null || true)"
  fi
fi

if [ -z "$PYTHON_BIN" ]; then
  echo "HATA: Python bulunamadı. VISION_BOOTSTRAP_PYTHON env değişkeni ile belirtin."
  exit 1
fi

echo "Python: $PYTHON_BIN ($($PYTHON_BIN --version))"
echo "Venv: $VENV_DIR"

"$PYTHON_BIN" -m venv "$VENV_DIR"

# uv varsa pip yerine uv pip kullan (çok daha hızlı)
if command -v uv >/dev/null 2>&1; then
  UV_CACHE_DIR="${UV_CACHE_DIR:-/tmp/uv-cache}"
  export UV_CACHE_DIR
  uv pip install --python "$VENV_DIR/bin/python" -r "$REQUIREMENTS_FILE"
else
  "$VENV_DIR/bin/pip" install -q -r "$REQUIREMENTS_FILE"
fi

echo ""
echo "Vision environment hazır: $VENV_DIR"
