#!/usr/bin/env bash
set -euo pipefail

# Installer for XenoGenesis systemd service on Linux
# This script will:
#  - Create a dedicated user/group (xeno)
#  - Install the app into /opt/xenogenesis (or symlink your current repo)
#  - Create /etc/xenogenesis/xenogenesis.env for environment variables
#  - Install and enable the systemd service
#  - Start the service and show logs

SERVICE_NAME=xenogenesis
APP_DIR=/opt/xenogenesis
ENV_DIR=/etc/xenogenesis
ENV_FILE="$ENV_DIR/$SERVICE_NAME.env"
UNIT_SRC="$(cd "$(dirname "$0")" && pwd)/systemd/$SERVICE_NAME.service"
UNIT_DST=/etc/systemd/system/$SERVICE_NAME.service

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

# Create user and group if not exist
if ! id -u xeno >/dev/null 2>&1; then
  useradd -r -m -d /home/xeno -s /usr/sbin/nologin xeno
fi

# Create app directory if not exists
mkdir -p "$APP_DIR"

# If running inside the repo, offer to symlink the repo to /opt/xenogenesis
if [[ -f "package.json" && -f "app.js" ]]; then
  echo "Copying project files to $APP_DIR ..."
  rsync -a --delete --exclude node_modules ./ "$APP_DIR/"
else
  echo "Note: Run this script from the project root if you want it to copy files."
fi

# Install dependencies
cd "$APP_DIR"
if command -v npm >/dev/null 2>&1; then
  npm ci || npm install
else
  echo "npm not found. Please install Node.js and npm." >&2
  exit 1
fi

# Create env dir and default env file
mkdir -p "$ENV_DIR"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<'EOF'
# XenoGenesis environment variables
NODE_ENV=production
# Logging level: debug|info|warn|error|silent
LOG_LEVEL=info
# Mongo connection (override Database.js fallback)
# MONGO_URI=mongodb://localhost:27017/xenogenesis
# Or use SRV
# MONGODB_URI=mongodb+srv://user:pass@cluster.example.mongodb.net/xenogenesis
# Port (the app uses port 2000 by default)
PORT=2000
EOF
fi

# Install the systemd unit
install -D -m 0644 "$UNIT_SRC" "$UNIT_DST"

# Set ownership
chown -R xeno:xeno "$APP_DIR"
chmod -R u=rwX,g=rX,o= "$APP_DIR"

# Reload, enable, and start
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

# Show status and tail logs
systemctl --no-pager status "$SERVICE_NAME"
journalctl -u "$SERVICE_NAME" -f --since "5 minutes ago"
