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

# Prints the PID/command listening on $1, if any (requires lsof).
port_owner() {
  local port="$1"
  command -v lsof >/dev/null 2>&1 || return 0
  lsof -t -i ":$port" -sTCP:LISTEN 2>/dev/null | head -n1
}

port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    [ -n "$(port_owner "$port")" ]
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null && { exec 3<&- 3>&-; return 0; } || return 1
  fi
}

start_backend=true
start_frontend=true

if port_in_use 5000; then
  owner_pid="$(port_owner 5000)"
  echo "Port 5000 is already in use$( [ -n "$owner_pid" ] && printf ' (pid %s: %s)' "$owner_pid" "$(ps -p "$owner_pid" -o comm= 2>/dev/null)" )." >&2
  echo "Assuming the backend is already running; skipping backend startup." >&2
  start_backend=false
fi

if port_in_use 3000; then
  owner_pid="$(port_owner 3000)"
  echo "Port 3000 is already in use$( [ -n "$owner_pid" ] && printf ' (pid %s: %s)' "$owner_pid" "$(ps -p "$owner_pid" -o comm= 2>/dev/null)" )." >&2
  echo "Assuming the frontend is already running; skipping frontend startup." >&2
  start_frontend=false
fi

if [ "$start_backend" = false ] && [ "$start_frontend" = false ]; then
  echo "Both ports are already occupied; nothing to start." >&2
  trap - EXIT INT TERM
  exit 0
fi

if [ "$start_backend" = true ]; then
  echo "Starting backend (Flask) on http://localhost:5000 ..."
  (cd "$BACKEND_DIR" && ./venv/bin/python run.py) >"$LOG_DIR/backend.log" 2>&1 &
  PIDS+=("$!")
fi

if [ "$start_frontend" = true ]; then
  echo "Starting frontend (Vite) on http://localhost:3000 ..."
  (cd "$FRONTEND_DIR" && npm run dev) >"$LOG_DIR/frontend.log" 2>&1 &
  PIDS+=("$!")
fi

echo
[ "$start_backend" = true ] && echo "Backend log:  $LOG_DIR/backend.log"
[ "$start_frontend" = true ] && echo "Frontend log: $LOG_DIR/frontend.log"
echo "Press Ctrl+C to stop."

wait
