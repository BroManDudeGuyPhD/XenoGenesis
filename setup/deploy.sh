#!/usr/bin/env bash
set -euo pipefail

# CI/CD-friendly update script for XenoGenesis service
# This script is designed to be run by automated deployment systems

SERVICE_NAME=xenogenesis
APP_DIR=/opt/xenogenesis
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if we're root
if [[ $EUID -ne 0 ]]; then
    error "Please run as root (sudo)."
fi

# Check if service exists
if ! systemctl list-unit-files | grep -q "^$SERVICE_NAME.service"; then
    error "Service $SERVICE_NAME not found. Run install_systemd_service.sh first."
fi

log "Starting deployment..."
log "Source: $REPO_DIR"
log "Destination: $APP_DIR"
log "Git commit: $(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo 'unknown')"

# Health check function
health_check() {
    local max_attempts=30
    local attempt=1
    
    log "Performing health check..."
    
    while [ $attempt -le $max_attempts ]; do
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            log "Service is running (attempt $attempt/$max_attempts)"
            return 0
        fi
        
        warn "Service not ready, waiting... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    error "Service failed to start after $max_attempts attempts"
}

# Stop the service gracefully
log "Stopping service..."
if systemctl is-active --quiet "$SERVICE_NAME"; then
    systemctl stop "$SERVICE_NAME"
    sleep 2
fi

# Backup current deployment (optional)
if [[ -d "$APP_DIR" ]]; then
    log "Creating backup..."
    cp -r "$APP_DIR" "${APP_DIR}.backup.$(date +%Y%m%d_%H%M%S)" || warn "Backup failed"
fi

# Sync files from repo to production
log "Syncing files..."
rsync -av --delete \
    --exclude node_modules \
    --exclude .git \
    --exclude .github \
    --exclude .vscode \
    --exclude "*.log" \
    --exclude ".env*" \
    "$REPO_DIR/" "$APP_DIR/"

# Install/update dependencies
log "Installing dependencies..."
cd "$APP_DIR"
if [[ -f "package-lock.json" ]]; then
    npm ci --production
else
    npm install --production
fi

# Set ownership and permissions
log "Setting ownership and permissions..."
chown -R xeno:xeno "$APP_DIR"
chmod -R u=rwX,g=rX,o= "$APP_DIR"

# Start the service
log "Starting service..."
systemctl start "$SERVICE_NAME"

# Wait for service to be ready and perform health check
health_check

# Show final status
log "Deployment complete!"
systemctl --no-pager status "$SERVICE_NAME"

# Optional: Show recent logs
log "Recent logs:"
journalctl -u "$SERVICE_NAME" --no-pager -n 10