#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Building Frontend ==="
echo ""

cd "$ROOT_DIR/apps/portal-web"

# Run type check
echo "Running type check..."
npm run build

echo ""
echo "Build output: $ROOT_DIR/apps/portal-web/dist"
echo ""
echo "=== Build complete ==="
