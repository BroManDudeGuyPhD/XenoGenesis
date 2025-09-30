#!/usr/bin/env bash
set -euo pipefail

# Update script for XenoGenesis service
# This script updates the production service with latest code from the repo

SERVICE_NAME=xenogenesis
APP_DIR=/opt/xenogenesis
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Updating XenoGenesis service..."
echo "Source: $REPO_DIR"
echo "Destination: $APP_DIR"

# Check if we're root
if [[ $EUID -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

# Stop the service
echo "Stopping service..."
systemctl stop "$SERVICE_NAME"

# Sync files from repo to production
echo "Syncing files..."
rsync -av --delete --exclude node_modules --exclude .git --exclude .vscode "$REPO_DIR/" "$APP_DIR/"

# Install/update dependencies
echo "Installing dependencies..."
cd "$APP_DIR"
npm ci || npm install

# Set ownership
echo "Setting ownership..."
chown -R xeno:xeno "$APP_DIR"
chmod -R u=rwX,g=rX,o= "$APP_DIR"

# Start the service
echo "Starting service..."
systemctl start "$SERVICE_NAME"

# Show status
echo "Service status:"
systemctl --no-pager status "$SERVICE_NAME"

echo "Update complete!"