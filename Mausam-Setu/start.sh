#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
(cd frontend && npm ci)
(cd backend && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log) &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT
(cd frontend && npm run dev)
