#!/usr/bin/env bash
# Run once as root / with sudo:  sudo bash deploy/setup.sh
# Must be run from the project root (/srv/ppmap/PPMap).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$DEPLOY_DIR")"
CERT_DIR=/etc/ppmap/certs
HOSTNAME=ppmap.tailbda370.ts.net

INVOKING_USER="${SUDO_USER:-$(logname 2>/dev/null || echo zero)}"

echo "==> Allow current user to run tailscale cert without sudo"
tailscale set --operator="$INVOKING_USER"

echo "==> Creating cert directory"
mkdir -p "$CERT_DIR"

if [[ ! -f "$CERT_DIR/$HOSTNAME.crt" ]]; then
    echo "==> Fetching Tailscale TLS cert"
    tailscale cert \
        --cert-file "$CERT_DIR/$HOSTNAME.crt" \
        --key-file  "$CERT_DIR/$HOSTNAME.key" \
        "$HOSTNAME"
else
    echo "==> Cert already exists, skipping fetch"
fi
chown caddy:caddy "$CERT_DIR" "$CERT_DIR/$HOSTNAME.crt" "$CERT_DIR/$HOSTNAME.key"
chmod 750 "$CERT_DIR"
chmod 640 "$CERT_DIR/$HOSTNAME.crt" "$CERT_DIR/$HOSTNAME.key"

echo "==> Waiting for apt lock..."
while fuser /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock &>/dev/null; do
    sleep 2
done

echo "==> Installing Caddy"
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

echo "==> Installing Caddyfile"
cp "$DEPLOY_DIR/Caddyfile" /etc/caddy/Caddyfile

echo "==> Installing systemd units"
cp "$DEPLOY_DIR/ppmap.service"              /etc/systemd/system/ppmap.service
cp "$DEPLOY_DIR/ppmap-cert-renew.service"   /etc/systemd/system/ppmap-cert-renew.service
cp "$DEPLOY_DIR/ppmap-cert-renew.timer"     /etc/systemd/system/ppmap-cert-renew.timer
systemctl daemon-reload

echo "==> Enabling and starting services"
systemctl enable --now caddy
systemctl enable --now ppmap
systemctl enable --now ppmap-cert-renew.timer

echo ""
echo "Done. Check status with:"
echo "  systemctl status ppmap caddy"
echo "  curl -sk https://$HOSTNAME/ -o /dev/null -w '%{http_code}'"
