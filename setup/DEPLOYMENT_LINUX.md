# XenoGenesis Linux Deployment

This guide shows how to run XenoGenesis as a Linux service using systemd. It also covers environment configuration and logs.

## Prerequisites
- Ubuntu/Debian/CentOS/etc with systemd
- Node.js 18+ (LTS recommended) and npm
- MongoDB reachable at ironman:27017 or localhost:27017 (or provide MONGO_URI)
- sudo/root access

## Quick Install (recommended)

Run from the project root on the target machine:

```bash
sudo bash setup/install_systemd_service.sh
```

This will:
- Create user/group `xeno`
- Copy the project to `/opt/xenogenesis`
- Install npm dependencies
- Create `/etc/xenogenesis/xenogenesis.env`
- Install and enable the `xenogenesis.service`
- Start the service and tail logs

## Environment variables

The service reads `/etc/xenogenesis/xenogenesis.env`:

- NODE_ENV=production
- LOG_LEVEL=info (debug|info|warn|error|silent)
- MONGO_URI=mongodb://localhost:27017/xenogenesis (optional override for Database.js)
- MONGODB_URI=... (alternative env var)
- PORT=2000 (the app listens on 2000 by default)

Edit the file and restart the service:

```bash
sudo nano /etc/xenogenesis/xenogenesis.env
sudo systemctl restart xenogenesis
```

## Manual service install (optional)

Copy the unit file and adjust paths if needed:

```bash
sudo install -D -m 0644 setup/systemd/xenogenesis.service /etc/systemd/system/xenogenesis.service
sudo systemctl daemon-reload
sudo systemctl enable xenogenesis
sudo systemctl start xenogenesis
```

## Logs

Follow logs in real time:

```bash
journalctl -u xenogenesis -f
```

If you want DEBUG logs, set:

```bash
sudo sed -i 's/LOG_LEVEL=info/LOG_LEVEL=debug/' /etc/xenogenesis/xenogenesis.env
sudo systemctl restart xenogenesis
```

## Updating the service

Deploy new code and restart:

```bash
sudo rsync -a --delete --exclude node_modules ./ /opt/xenogenesis/
cd /opt/xenogenesis && sudo -u xeno npm ci || sudo -u xeno npm install
sudo systemctl restart xenogenesis
```

## Troubleshooting

- Service won’t start (exit code 1):
  - Check logs: `journalctl -u xenogenesis -n 200 --no-pager`
  - Verify Node path in unit (`/usr/bin/node`), adjust if your Node is elsewhere (use `which node`).
  - Ensure MongoDB is reachable; set `MONGO_URI` to a valid host if `ironman` isn’t resolvable.
  - Temporarily increase verbosity: set `LOG_LEVEL=debug` and restart.

- Port 2000 already in use:
  - Find the process: `sudo ss -lntp | grep :2000`
  - Change PORT in env or stop the other service.

- Permission issues in /opt/xenogenesis:
  - `sudo chown -R xeno:xeno /opt/xenogenesis`
  - `sudo chmod -R u=rwX,g=rX,o= /opt/xenogenesis`

## Uninstall

```bash
sudo systemctl stop xenogenesis
sudo systemctl disable xenogenesis
sudo rm -f /etc/systemd/system/xenogenesis.service
sudo systemctl daemon-reload
sudo rm -rf /opt/xenogenesis /etc/xenogenesis
sudo userdel -r xeno || true
```
