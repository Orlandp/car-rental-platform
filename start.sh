#!/usr/bin/env bash
# Starts the Flask backend and the Vite frontend together for local dev.
# Usage: ./start.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/front-end"
LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$LOG_DIR"

if [ ! -x "$BACKEND_DIR/venv/bin/python" ]; then
  echo "Backend venv not found. Set it up first:" >&2
  echo "  cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements-dev.txt" >&2
  exit 1
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "Frontend dependencies not installed. Run 'npm install' in front-end/ first." >&2
  exit 1
fi

PIDS=()

cleanup() {
  echo
  echo "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting backend (Flask) on http://localhost:5000 ..."
(cd "$BACKEND_DIR" && ./venv/bin/python run.py) >"$LOG_DIR/backend.log" 2>&1 &
PIDS+=("$!")

echo "Starting frontend (Vite) on http://localhost:3000 ..."
(cd "$FRONTEND_DIR" && npm run dev) >"$LOG_DIR/frontend.log" 2>&1 &
PIDS+=("$!")

echo
echo "Backend log:  $LOG_DIR/backend.log"
echo "Frontend log: $LOG_DIR/frontend.log"
echo "Press Ctrl+C to stop both."

wait
