#!/usr/bin/env bash
# Maxwell Family HQ — start server + client together
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

cleanup() {
  echo
  echo "[maxwell-hq] shutting down…"
  kill "${SERVER_PID:-}" "${CLIENT_PID:-}" 2>/dev/null || true
  wait 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

echo "[maxwell-hq] starting API server on :3001"
( cd server && npm start ) &
SERVER_PID=$!

sleep 1

echo "[maxwell-hq] starting client on :5173"
( cd client && npm run dev ) &
CLIENT_PID=$!

wait
