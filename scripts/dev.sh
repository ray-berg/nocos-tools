#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Cleanup function
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $API_PID 2>/dev/null || true
    kill $WEB_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "=== Starting Development Servers ==="
echo ""

# Start API server
echo "Starting API server on http://127.0.0.1:9000..."
cd "$ROOT_DIR/apps/portal-api"
source venv/bin/activate
PORTAL_DEBUG=true uvicorn app.main:app --reload --host 127.0.0.1 --port 9000 &
API_PID=$!

# Start web dev server
echo "Starting web dev server on http://127.0.0.1:5173..."
cd "$ROOT_DIR/apps/portal-web"
npm run dev &
WEB_PID=$!

echo ""
echo "=== Development servers running ==="
echo "  API: http://127.0.0.1:9000"
echo "  Web: http://127.0.0.1:5173"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Wait for both processes
wait $API_PID $WEB_PID
