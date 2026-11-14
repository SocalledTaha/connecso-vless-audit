#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="vless-audit"
APP_DIR="/opt/vless-audit"
CONFIG_DIR="/etc/vless-audit"
DATA_DIR="/var/lib/vless-audit"
PURGE_DATA=0

[[ "${EUID:-$(id -u)}" -eq 0 ]] || { echo 'Run this uninstaller as root.' >&2; exit 1; }
if [[ "${1:-}" == "--purge-data" ]]; then PURGE_DATA=1
elif [[ $# -gt 0 ]]; then echo 'Usage: uninstall.sh [--purge-data]' >&2; exit 2
fi

systemctl disable --now "$APP_NAME.service" 2>/dev/null || true
rm -f "/etc/systemd/system/$APP_NAME.service"
systemctl daemon-reload
rm -rf -- "$APP_DIR" "$CONFIG_DIR"
rm -f /usr/local/bin/ConnecsoTools /usr/local/bin/connecsotools
rm -rf -- /usr/local/lib/connecso-tools
rm -f /etc/letsencrypt/renewal-hooks/pre/20-vless-audit \
  /etc/letsencrypt/renewal-hooks/post/20-vless-audit \
  /etc/letsencrypt/renewal-hooks/deploy/20-vless-audit

if (( PURGE_DATA )); then
  rm -rf -- "$DATA_DIR"
  if id "$APP_NAME" >/dev/null 2>&1; then userdel "$APP_NAME"; fi
  if getent group "$APP_NAME" >/dev/null; then groupdel "$APP_NAME"; fi
  echo 'Application and saved audit data removed.'
else
  echo "Application removed. Saved audit data remains at $DATA_DIR."
  echo "To remove the saved data later, rerun with --purge-data."
fi
echo 'Xray, other panels, Let’s Encrypt certificates, and web services were left untouched.'
