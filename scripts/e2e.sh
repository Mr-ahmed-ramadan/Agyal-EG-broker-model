#!/usr/bin/env bash
# Runs the end-to-end trading flow (buy and sell) against real processes:
# PostgreSQL (must be running) + bank simulator + FIX gateway + API.
# WARNING: resets the database in DATABASE_URL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://agyal:agyal@localhost:5432/agyal_broker?schema=public}"
export PORT="${PORT:-3000}"
# Return OTP codes in API responses so the test can complete sign-in (never in production).
export OTP_DEV_ECHO=true
export SEED_DEMO_CLIENT=false
# Allow confirming coupons/redemptions before their payment date (demo/testing only).
export DEMO_MODE=true
export API_URL="http://localhost:${PORT}"
LOG_DIR="$(mktemp -d)"
PIDS=()

cleanup() {
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT

wait_for_log() { # file pattern count timeout
  for _ in $(seq 1 "$4"); do
    [ "$(grep -c "$2" "$1" 2>/dev/null || true)" -ge "$3" ] && return 0
    sleep 1
  done
  echo "Timed out waiting for '$2' in $1"; tail -20 "$1"; return 1
}

echo "== Building"
npm run build --workspace packages/shared-types >/dev/null
npm run build --workspace services/api >/dev/null
(cd "$ROOT/services/fix-gateway" && ./gradlew installDist --no-daemon -q)

echo "== Resetting and seeding database"
(cd "$ROOT/services/api" && npx prisma migrate reset --force --skip-generate >/dev/null)

GW_LIB="$ROOT/services/fix-gateway/build/install/fix-gateway/lib/*"
rm -rf "$ROOT/services/fix-gateway/store"

echo "== Starting bank simulator, FIX gateway and API (logs in $LOG_DIR)"
(cd "$ROOT/services/fix-gateway" && exec java -cp "$GW_LIB" eg.agyal.fixgateway.simulator.BankSimulator) >"$LOG_DIR/simulator.log" 2>&1 &
PIDS+=($!)
sleep 2
(cd "$ROOT/services/fix-gateway" && exec java -cp "$GW_LIB" eg.agyal.fixgateway.GatewayApplication) >"$LOG_DIR/gateway.log" 2>&1 &
PIDS+=($!)
(cd "$ROOT/services/api" && exec node dist/main.js) >"$LOG_DIR/api.log" 2>&1 &
PIDS+=($!)

wait_for_log "$LOG_DIR/gateway.log" "Logon:" 2 30
for _ in $(seq 1 30); do curl -sf "$API_URL/health" >/dev/null && break; sleep 1; done

echo "== Running end-to-end checks"
(cd "$ROOT/services/api" && npx tsx test/e2e/trading-flow.e2e.ts) || {
  echo "--- api.log"; tail -30 "$LOG_DIR/api.log"
  echo "--- gateway.log"; grep -iE "error|exception" "$LOG_DIR/gateway.log" | tail -20
  exit 1
}
