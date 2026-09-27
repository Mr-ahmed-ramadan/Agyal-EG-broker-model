#!/usr/bin/env sh
# Starts the demo bank simulator (FIX acceptor, two banks on port 9880) and
# the FIX gateway (initiator + outbox/inbox bridge). When real banks are
# connected, run only the gateway with that bank's session config instead.
set -e
cd "$(dirname "$0")"
CP="lib/*"

java -cp "$CP" eg.agyal.fixgateway.simulator.BankSimulator &
SIM=$!
# Give the acceptor a moment to bind before the gateway logs on (it also retries every 5s).
sleep 3
java -cp "$CP" eg.agyal.fixgateway.GatewayApplication &
GW=$!

trap 'kill $SIM $GW 2>/dev/null' TERM INT
# Exit (so the platform restarts the container) if either process dies.
while kill -0 $SIM 2>/dev/null && kill -0 $GW 2>/dev/null; do sleep 5; done
echo "A FIX process exited; stopping container" >&2
kill $SIM $GW 2>/dev/null || true
exit 1
