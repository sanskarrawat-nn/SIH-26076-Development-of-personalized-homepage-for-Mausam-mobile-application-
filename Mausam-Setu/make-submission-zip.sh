#!/usr/bin/env bash
set -euo pipefail

echo "============================================"
echo "Building Mausam Setu Clean Submission Zip"
echo "============================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if command -v python3 >/dev/null 2>&1; then
    python3 scripts/make_submission_zip.py
elif command -v python >/dev/null 2>&1; then
    python scripts/make_submission_zip.py
elif [ -f "backend/.venv/bin/python" ]; then
    backend/.venv/bin/python scripts/make_submission_zip.py
else
    echo "ERROR: Python 3 executable not found. Please install Python 3.12+."
    exit 1
fi
