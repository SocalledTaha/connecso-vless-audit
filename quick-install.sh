#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="https://github.com/SocalledTaha/connecso-vless-audit.git"
PROJECT_DIR="/opt/vless-audit/project-source"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  printf 'Run this installer as root. Example:\n  curl -fsSL https://raw.githubusercontent.com/SocalledTaha/connecso-vless-audit/main/quick-install.sh | sudo bash\n' >&2
  exit 1
fi
command -v apt-get >/dev/null 2>&1 || { echo 'Ubuntu or Debian is required.' >&2; exit 1; }

if ! command -v git >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y git
fi

install -d -m 0755 "$(dirname "$PROJECT_DIR")"
if [[ -d "$PROJECT_DIR/.git" ]]; then
  git -c safe.directory="$PROJECT_DIR" -C "$PROJECT_DIR" pull --ff-only origin main
elif [[ -e "$PROJECT_DIR" ]]; then
  echo "$PROJECT_DIR exists but is not a Git checkout; leaving it untouched." >&2
  exit 1
else
  git clone --branch main --depth 1 "$REPO_URL" "$PROJECT_DIR"
fi

exec bash "$PROJECT_DIR/install.sh" "$@"
