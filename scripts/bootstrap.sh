#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Internal Tools Portal Bootstrap ==="
echo ""

# Check system dependencies
echo "Checking system dependencies..."

check_cmd() {
    if ! command -v "$1" &> /dev/null; then
        echo "ERROR: $1 is not installed."
        echo "Install with: $2"
        exit 1
    fi
    echo "  [OK] $1"
}

check_cmd python3.12 "sudo apt install python3.12 python3.12-venv"
check_cmd node "See https://nodejs.org/ or: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
check_cmd npm "Installed with Node.js"

echo ""

# Setup Python virtual environment
echo "Setting up Python virtual environment..."
cd "$ROOT_DIR/apps/portal-api"

if [ ! -d "venv" ]; then
    python3.12 -m venv venv
    echo "  Created venv"
else
    echo "  venv already exists"
fi

source venv/bin/activate
pip install --upgrade pip -q
pip install -e ".[dev]" -q
echo "  [OK] Python dependencies installed"

# Setup Node.js dependencies
echo ""
echo "Setting up Node.js dependencies..."
cd "$ROOT_DIR/apps/portal-web"
npm install --silent
echo "  [OK] Node.js dependencies installed"

echo ""
echo "=== Bootstrap complete ==="
echo ""
echo "To start development servers, run:"
echo "  make dev"
echo ""
echo "Or manually:"
echo "  cd apps/portal-api && source venv/bin/activate && uvicorn app.main:app --reload --host 127.0.0.1 --port 9000"
echo "  cd apps/portal-web && npm run dev"
