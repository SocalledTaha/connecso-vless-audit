#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="https://github.com/SocalledTaha/connecso-vless-audit.git"
PROJECT_DIR="/opt/vless-audit/project-source"
STAGING_DIR=""

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  C_RESET=$'\033[0m'; C_CYAN=$'\033[1;36m'; C_GREEN=$'\033[1;32m'; C_RED=$'\033[1;31m'; C_BOLD=$'\033[1m'
else
  C_RESET=''; C_CYAN=''; C_GREEN=''; C_RED=''; C_BOLD=''
fi
cleanup() { [[ -z "$STAGING_DIR" ]] || rm -rf -- "$STAGING_DIR"; }
trap cleanup EXIT
fail() { printf '%sError:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }
printf '\n%s╭──────────────────────────────────────────────────────────────╮%s\n' "$C_CYAN" "$C_RESET"
printf '%s│%s  %sConnecso Outbound Audit%s  %s· quick installer%s             %s│%s\n' "$C_CYAN" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_GREEN" 'Ubuntu · Debian' "$C_CYAN" "$C_RESET"
printf '%s╰──────────────────────────────────────────────────────────────╯%s\n' "$C_CYAN" "$C_RESET"

[[ "${EUID:-$(id -u)}" -eq 0 ]] || fail 'Run as root, for example: curl -fsSL https://raw.githubusercontent.com/SocalledTaha/connecso-vless-audit/main/quick-install.sh | sudo bash'
command -v apt-get >/dev/null 2>&1 || fail 'Ubuntu or Debian is required.'
[[ -r /etc/os-release ]] || fail 'Could not identify this Linux distribution.'
# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == ubuntu || "${ID:-}" == debian ]] || fail "Unsupported distribution: ${PRETTY_NAME:-unknown}."

if ! command -v git >/dev/null 2>&1; then
  printf '%s›%s Installing the Git package without running service-restart hooks…\n' "$C_CYAN" "$C_RESET"
  NEEDRESTART_SUSPEND=1 DEBIAN_FRONTEND=noninteractive apt-get update -o Acquire::Retries=3
  NEEDRESTART_SUSPEND=1 DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends git ca-certificates
fi

install -d -m 0755 "$(dirname "$PROJECT_DIR")"
if [[ -d "$PROJECT_DIR/.git" ]]; then
  [[ -z "$(git -c safe.directory="$PROJECT_DIR" -C "$PROJECT_DIR" status --porcelain)" ]] || fail 'The existing project checkout has local changes; update or back it up first.'
  [[ "$(git -c safe.directory="$PROJECT_DIR" -C "$PROJECT_DIR" branch --show-current)" == main ]] || fail 'The existing project checkout is not on the main branch.'
  printf '%s›%s Refreshing the project from GitHub…\n' "$C_CYAN" "$C_RESET"
  git -c safe.directory="$PROJECT_DIR" -C "$PROJECT_DIR" fetch --prune origin main
  git -c safe.directory="$PROJECT_DIR" -C "$PROJECT_DIR" merge --ff-only origin/main
elif [[ -e "$PROJECT_DIR" ]]; then
  fail "$PROJECT_DIR exists but is not a Git checkout; it was left untouched."
else
  STAGING_DIR="$(mktemp -d "$(dirname "$PROJECT_DIR")/.connecso-source.XXXXXX")"
  printf '%s›%s Downloading the project source…\n' "$C_CYAN" "$C_RESET"
  git clone --branch main --depth 1 "$REPO_URL" "$STAGING_DIR"
  mv -- "$STAGING_DIR" "$PROJECT_DIR"
  STAGING_DIR=""
fi

printf '%s✓%s Source ready. Resuming installation if needed.\n\n' "$C_GREEN" "$C_RESET"
exec bash "$PROJECT_DIR/install.sh" "$@"
