#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="vless-audit"
APP_DIR="/opt/vless-audit"
DATA_DIR="/var/lib/vless-audit"
CONFIG_DIR="/etc/vless-audit"
STATE_FILE="$DATA_DIR/install-state.env"
REQUEST="$DATA_DIR/results/update-request.json"
STATUS="$DATA_DIR/results/update-status.json"
LOCK="$DATA_DIR/update.lock"

exec 9>"$LOCK"
flock -n 9 || exit 0
[[ -s "$REQUEST" ]] || exit 0
REQUEST_ACTIVE="$REQUEST.active.$$"
mv -- "$REQUEST" "$REQUEST_ACTIVE"

request_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("id", ""))' "$REQUEST_ACTIVE" 2>/dev/null || true)"
[[ "$request_id" =~ ^[a-f0-9]{20}$ ]] || request_id="unknown"
rm -f -- "$REQUEST_ACTIVE"
status_written=0

write_status() {
  local state="$1" error="${2:-}" temp="$STATUS.tmp"
  python3 - "$request_id" "$state" "$error" > "$temp" <<'PY'
import datetime,json,sys
print(json.dumps({"id":sys.argv[1],"state":sys.argv[2],"error":sys.argv[3],"updatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat()}))
PY
  chown "$APP_NAME:$APP_NAME" "$temp"
  chmod 0640 "$temp"
  mv -f -- "$temp" "$STATUS"
}
fail() { status_written=1; write_status failed "$1"; exit 1; }
on_exit() { local code=$?; if (( code != 0 && status_written == 0 )); then write_status failed "Update process stopped unexpectedly." || true; fi; }
trap on_exit EXIT

write_status checking
[[ -r "$STATE_FILE" ]] || fail "Installer state is missing."
# The installer writes this root-owned file with shell-escaped values.
# shellcheck disable=SC1090
source "$STATE_FILE"
PROJECT_DIR="${PROJECT_DIR:-}"
[[ -n "$PROJECT_DIR" && -d "$PROJECT_DIR/.git" ]] || fail "GitHub source checkout was not found."
[[ "$(git -C "$PROJECT_DIR" remote get-url origin 2>/dev/null || true)" =~ ^(https://github\.com/SocalledTaha/connecso-vless-audit\.git|git@github\.com:SocalledTaha/connecso-vless-audit\.git)$ ]] || fail "The configured source is not the expected GitHub repository."
[[ -z "$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null)" ]] || fail "Local source changes were found; update cancelled to protect them."
branch="$(git -C "$PROJECT_DIR" branch --show-current)"
[[ "$branch" == main ]] || fail "The source checkout is not on the main branch."

write_status downloading
git -C "$PROJECT_DIR" fetch --prune origin main >/dev/null 2>&1 || fail "Could not fetch the latest GitHub version."
git -C "$PROJECT_DIR" merge --ff-only origin/main >/dev/null 2>&1 || fail "The local checkout cannot be updated safely."

write_status installing
backup="$(mktemp /var/lib/vless-audit/panel-update-backup.XXXXXX.tar.gz)"
tar -C "$APP_DIR" -czf "$backup" server.mjs src public 2>/dev/null || fail "Could not create a rollback copy."
install -d -o root -g "$APP_NAME" -m 0750 "$APP_DIR" "$APP_DIR/src" "$APP_DIR/public" "$APP_DIR/public/assets"
install -o root -g "$APP_NAME" -m 0640 "$PROJECT_DIR/server.mjs" "$APP_DIR/server.mjs"
for file in vless.mjs probe.mjs store.mjs; do install -o root -g "$APP_NAME" -m 0640 "$PROJECT_DIR/src/$file" "$APP_DIR/src/$file"; done
for file in index.html app.js app.css login.html login.js login.css favicon.svg; do install -o root -g "$APP_NAME" -m 0640 "$PROJECT_DIR/public/$file" "$APP_DIR/public/$file"; done
if [[ -d "$PROJECT_DIR/public/assets" ]]; then
  while IFS= read -r -d '' file; do
    relative="${file#"$PROJECT_DIR/public/"}"
    install -D -o root -g "$APP_NAME" -m 0640 "$file" "$APP_DIR/$relative"
  done < <(find "$PROJECT_DIR/public/assets" -type f -print0)
fi

write_status restarting
if ! systemctl restart "$APP_NAME.service"; then
  tar -C "$APP_DIR" -xzf "$backup"
  systemctl restart "$APP_NAME.service" || true
  rm -f -- "$backup"
  fail "The panel did not restart; the previous files were restored."
fi
for _ in {1..30}; do
  systemctl is-active --quiet "$APP_NAME.service" && break
  sleep 1
done
if ! systemctl is-active --quiet "$APP_NAME.service"; then
  tar -C "$APP_DIR" -xzf "$backup"
  systemctl restart "$APP_NAME.service" || true
  rm -f -- "$backup"
  fail "The updated panel did not become ready; the previous files were restored."
fi
rm -f -- "$backup"
write_status complete
status_written=1
