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
  trap - EXIT INT TERM
  echo
  echo "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Prints the PID listening on $1, if any (requires lsof). Always returns 0:
# lsof exits non-zero when nothing matches, which is the common "port free"
# case, not an error — never let that trip set -e/pipefail.
port_owner() {
  local port="$1"
  command -v lsof >/dev/null 2>&1 || return 0
  lsof -t -i ":$port" -sTCP:LISTEN 2>/dev/null | head -n1 || true
}

# Prints the working directory of $1 (a PID), if it can be determined.
port_owner_cwd() {
  local pid="$1"
  if [ -r "/proc/$pid/cwd" ]; then
    readlink -f "/proc/$pid/cwd" 2>/dev/null || true
  fi
}

port_owner_cmd() {
  local pid="$1"
  if [ -r "/proc/$pid/comm" ]; then
    cat "/proc/$pid/comm" 2>/dev/null || true
  else
    ps -p "$pid" -o comm= 2>/dev/null || true
  fi
}

# Sets STATUS to one of: free | ours | other.
# "ours" means the process holding the port is running out of $2 (or a
# subdirectory of it); "other" means the port is held by an unrelated process.
check_port() {
  local port="$1" expected_dir="$2"
  local owner_pid owner_cwd
  owner_pid="$(port_owner "$port")"
  if [ -z "$owner_pid" ]; then
    # lsof found no PID for this port — either it's genuinely free, lsof
    # isn't installed, or lsof lacks permission to see the owning process
    # (e.g. it runs as another user). Don't assume "free": probe the socket
    # directly so an unattributable-but-real listener isn't mistaken for one.
    if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
      exec 3<&- 3>&-
      STATUS=other
      OWNER_DESC="unknown process (could not identify owner)"
    else
      STATUS=free
    fi
    return
  fi
  owner_cwd="$(port_owner_cwd "$owner_pid")"
  OWNER_DESC="pid $owner_pid: $(port_owner_cmd "$owner_pid")$( [ -n "$owner_cwd" ] && printf ' (%s)' "$owner_cwd" )"
  if [ -n "$owner_cwd" ] && case "$owner_cwd" in "$expected_dir"*) true ;; *) false ;; esac; then
    STATUS=ours
  else
    STATUS=other
  fi
}

# Finds a usable port starting at $1: reuses it if it's free or already
# ours, otherwise walks upward until a free one turns up. Sets PICKED_PORT.
pick_port() {
  local port="$1" expected_dir="$2" tries=0
  while [ "$tries" -lt 50 ]; do
    check_port "$port" "$expected_dir"
    if [ "$STATUS" != "other" ]; then
      PICKED_PORT="$port"
      return 0
    fi
    if [ "$tries" -eq 0 ]; then
      echo "Port $port is in use by an unrelated process ($OWNER_DESC) — that's not this app's. Looking for a free port instead..." >&2
    fi
    port=$((port + 1))
    tries=$((tries + 1))
  done
  echo "Could not find a free port near $1 after $tries tries." >&2
  exit 1
}

start_backend=true
start_frontend=true

pick_port 5000 "$BACKEND_DIR"
BACKEND_PORT="$PICKED_PORT"
BACKEND_STATUS="$STATUS"
if [ "$BACKEND_STATUS" = ours ]; then
  echo "Backend already running ($OWNER_DESC); skipping backend startup." >&2
  start_backend=false
fi

pick_port 3000 "$FRONTEND_DIR"
FRONTEND_PORT="$PICKED_PORT"
FRONTEND_STATUS="$STATUS"
if [ "$FRONTEND_STATUS" = ours ]; then
  echo "Frontend already running ($OWNER_DESC); skipping frontend startup." >&2
  start_frontend=false
fi

if [ "$start_backend" = false ] && [ "$start_frontend" = false ]; then
  echo "Both already running; nothing to start." >&2
  trap - EXIT INT TERM
  exit 0
fi

# Backend's CORS_ORIGINS must include wherever the frontend actually ended
# up (it may have moved off 3000), or the browser's API calls will be
# blocked even though both servers are up.
FRONTEND_ORIGIN="http://localhost:$FRONTEND_PORT"
cors_base=""
if [ -f "$BACKEND_DIR/.env" ]; then
  cors_base="$(grep -m1 '^CORS_ORIGINS=' "$BACKEND_DIR/.env" | cut -d= -f2-)"
fi
[ -z "$cors_base" ] && cors_base="http://localhost:5173,http://localhost:3000"
case ",$cors_base," in
  *",$FRONTEND_ORIGIN,"*) CORS_ORIGINS_EFFECTIVE="$cors_base" ;;
  *) CORS_ORIGINS_EFFECTIVE="$cors_base,$FRONTEND_ORIGIN" ;;
esac

if [ "$start_backend" = true ]; then
  echo "Starting backend (Flask) on http://localhost:$BACKEND_PORT ..."
  (cd "$BACKEND_DIR" && PORT="$BACKEND_PORT" CORS_ORIGINS="$CORS_ORIGINS_EFFECTIVE" ./venv/bin/python run.py) >"$LOG_DIR/backend.log" 2>&1 &
  PIDS+=("$!")
fi

if [ "$start_frontend" = true ]; then
  echo "Starting frontend (Vite) on http://localhost:$FRONTEND_PORT ..."
  (cd "$FRONTEND_DIR" && VITE_API_URL="http://localhost:$BACKEND_PORT" npm run dev -- --port "$FRONTEND_PORT" --strictPort) >"$LOG_DIR/frontend.log" 2>&1 &
  PIDS+=("$!")
fi

echo
[ "$start_backend" = true ] && echo "Backend log:  $LOG_DIR/backend.log"
[ "$start_frontend" = true ] && echo "Frontend log: $LOG_DIR/frontend.log"

# Polls $1 (a URL) until it responds or $2 seconds elapse.
wait_for_http() {
  local url="$1" timeout="$2" waited=0
  while ! curl -fsS -o /dev/null "$url" 2>/dev/null; do
    sleep 1
    waited=$((waited + 1))
    if [ "$waited" -ge "$timeout" ]; then
      return 1
    fi
  done
  return 0
}

if command -v curl >/dev/null 2>&1; then
  if [ "$start_backend" = true ]; then
    echo -n "Waiting for backend to respond on http://localhost:$BACKEND_PORT/api/health ... "
    if wait_for_http "http://localhost:$BACKEND_PORT/api/health" 30; then
      echo "up"
    else
      echo "not responding after 30s"
      echo "  Check $LOG_DIR/backend.log:" >&2
      tail -n 20 "$LOG_DIR/backend.log" >&2 || true
    fi
  fi

  if [ "$start_frontend" = true ]; then
    echo -n "Waiting for frontend to respond on http://localhost:$FRONTEND_PORT ... "
    if wait_for_http "http://localhost:$FRONTEND_PORT" 30; then
      echo "up"
    else
      echo "not responding after 30s"
      echo "  Check $LOG_DIR/frontend.log:" >&2
      tail -n 20 "$LOG_DIR/frontend.log" >&2 || true
    fi
  fi
else
  echo "curl not found; skipping health checks." >&2
fi

echo
echo "Press Ctrl+C to stop."

wait
