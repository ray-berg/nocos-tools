#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

INSTALL_DIR="${INSTALL_DIR:-/opt/portal}"
NGINX_SITES="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

echo "=== Installing Internal Tools Portal ==="
echo ""
echo "Install directory: $INSTALL_DIR"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: This script must be run as root (for systemd/nginx setup)"
    echo "Usage: sudo $0"
    exit 1
fi

# Create install directory
echo "Creating install directory..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/www"
mkdir -p "$INSTALL_DIR/api"

# Copy API
echo "Installing API..."
cp -r "$ROOT_DIR/apps/portal-api/app" "$INSTALL_DIR/api/"
cp "$ROOT_DIR/apps/portal-api/pyproject.toml" "$INSTALL_DIR/api/"

# Create venv in install location
echo "Setting up Python environment..."
cd "$INSTALL_DIR/api"
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install -e . -q
deactivate

# Build and copy frontend
echo "Building and installing frontend..."
cd "$ROOT_DIR/apps/portal-web"
npm run build
cp -r dist/* "$INSTALL_DIR/www/"

# Install systemd service
echo "Installing systemd service..."
cp "$ROOT_DIR/infra/systemd/portal-api.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable portal-api

# Install nginx config
echo "Installing nginx config..."
cp "$ROOT_DIR/infra/nginx/portal.conf" "$NGINX_SITES/portal"

# Enable nginx site
if [ ! -L "$NGINX_ENABLED/portal" ]; then
    ln -s "$NGINX_SITES/portal" "$NGINX_ENABLED/portal"
fi

# Test nginx config
echo "Testing nginx configuration..."
nginx -t

echo ""
echo "=== Installation complete ==="
echo ""
echo "To start the services:"
echo "  sudo systemctl start portal-api"
echo "  sudo systemctl reload nginx"
echo ""
echo "To check status:"
echo "  sudo systemctl status portal-api"
echo "  curl http://localhost/api/health"
echo ""
echo "Logs:"
echo "  sudo journalctl -u portal-api -f"
