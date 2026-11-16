#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="vless-audit"
APP_DIR="/opt/vless-audit"
DATA_DIR="/var/lib/vless-audit"
CONFIG_DIR="/etc/vless-audit"
STATE_FILE="$CONFIG_DIR/install-state.env"
LEGACY_STATE_FILE="$DATA_DIR/install-state.env"
REQUEST="$DATA_DIR/results/update-request.json"
STATUS="$DATA_DIR/results/update-status.json"
LOCK="$DATA_DIR/update.lock"
stage="startup"
backup=""
stage_started_at=""
last_message=""
heartbeat_pid=""

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
  local state="$1" error="${2:-}" message="${3:-}" temp="$STATUS.tmp"
  if [[ "$message" != "$last_message" || -z "$stage_started_at" ]]; then
    stage_started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    last_message="$message"
  fi
  python3 - "$request_id" "$state" "$error" "$message" "$stage_started_at" > "$temp" <<'PY'
import datetime,json,sys
print(json.dumps({"id":sys.argv[1],"state":sys.argv[2],"error":sys.argv[3],"message":sys.argv[4],"stageStartedAt":sys.argv[5],"updatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat()}))
PY
  chown "$APP_NAME:$APP_NAME" "$temp"
  chmod 0640 "$temp"
  mv -f -- "$temp" "$STATUS"
}
fail() { status_written=1; write_status failed "$1" updateFailed; exit 1; }
stop_heartbeat() {
  if [[ -n "$heartbeat_pid" ]]; then
    kill "$heartbeat_pid" 2>/dev/null || true
    wait "$heartbeat_pid" 2>/dev/null || true
    heartbeat_pid=""
  fi
}
on_error() {
  local code="$1" line="$2" command="$3"
  (( code != 0 )) || return 0
  trap - ERR
  stop_heartbeat
  status_written=1
  local detail="Unexpected failure during ${stage} (line ${line}, exit ${code}): ${command}"
  write_status failed "$detail" updateFailed || true
  logger -t connecso-panel-update -- "$detail" 2>/dev/null || true
  if [[ -n "$backup" && -s "$backup" ]]; then
    tar -C "$APP_DIR" -xzf "$backup" 2>/dev/null || true
    systemctl restart "$APP_NAME.service" 2>/dev/null || true
    rm -f -- "$backup" 2>/dev/null || true
  fi
  exit "$code"
}
on_exit() { local code=$?; stop_heartbeat; if (( code != 0 && status_written == 0 )); then write_status failed "Update stopped unexpectedly during ${stage} (exit ${code})." || true; fi; }
trap 'on_error "$?" "$LINENO" "$BASH_COMMAND"' ERR
trap on_exit EXIT

stage="checking installation"
write_status checking "" updateChecking
if [[ -e "$STATE_FILE" || -L "$STATE_FILE" ]]; then
  [[ -f "$STATE_FILE" && ! -L "$STATE_FILE" && "$(stat -c '%u:%a' "$STATE_FILE" 2>/dev/null || true)" == '0:600' ]] \
    || fail "Installer state permissions are unsafe; refusing to load it as root."
  # The installer writes this root-owned file with shell-escaped values.
  # shellcheck disable=SC1090
  source "$STATE_FILE"
elif [[ -e "$LEGACY_STATE_FILE" || -L "$LEGACY_STATE_FILE" ]]; then
  [[ -f "$LEGACY_STATE_FILE" && ! -L "$LEGACY_STATE_FILE" && "$(stat -c '%u:%a' "$LEGACY_STATE_FILE" 2>/dev/null || true)" == '0:600' ]] \
    || fail "Legacy installer state permissions are unsafe; refusing to load it as root."
  # Older releases stored the same root-owned, shell-escaped state under DATA_DIR.
  # shellcheck disable=SC1090
  source "$LEGACY_STATE_FILE"
else
  # The updater only needs the trusted source checkout and Node runtime. Recover
  # those from the installer's stable locations when state was never migrated.
  PROJECT_DIR="/opt/vless-audit/project-source"
fi
PROJECT_DIR="${PROJECT_DIR:-/opt/vless-audit/project-source}"
if [[ -z "${NODE_BIN:-}" || ! -x "${NODE_BIN:-/nonexistent}" ]]; then
  NODE_BIN="$(command -v node 2>/dev/null || true)"
fi
if [[ -z "${NODE_BIN:-}" || ! -x "$NODE_BIN" ]]; then
  for candidate in "$APP_DIR"/runtime/node-*/bin/node; do
    if [[ -x "$candidate" ]]; then NODE_BIN="$candidate"; break; fi
  done
fi
[[ -n "${NODE_BIN:-}" && -x "$NODE_BIN" ]] || fail "Could not locate the installed Node.js runtime. Rerun the installer to repair runtime settings."
[[ -n "$PROJECT_DIR" && -d "$PROJECT_DIR/.git" ]] || fail "GitHub source checkout was not found."
[[ "$(git -C "$PROJECT_DIR" remote get-url origin 2>/dev/null || true)" =~ ^(https://github\.com/SocalledTaha/connecso-vless-audit\.git|git@github\.com:SocalledTaha/connecso-vless-audit\.git)$ ]] || fail "The configured source is not the expected GitHub repository."
[[ -z "$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null)" ]] || fail "Local source changes were found; update cancelled to protect them."
branch="$(git -C "$PROJECT_DIR" branch --show-current)"
[[ "$branch" == main ]] || fail "The source checkout is not on the main branch."

stage="fetching GitHub source"
write_status downloading "" updateDownloading
git -C "$PROJECT_DIR" fetch --prune origin main >/dev/null 2>&1 || fail "Could not fetch the latest GitHub version."
git -C "$PROJECT_DIR" merge --ff-only origin/main >/dev/null 2>&1 || fail "The local checkout cannot be updated safely."

stage="backing up and installing panel files"
write_status installing "" updatePreparing
backup="$(mktemp /var/lib/vless-audit/panel-update-backup.XXXXXX.tar.gz)"
backup_paths=(server.mjs src public)
for item in package.json package-lock.json node_modules; do [[ -e "$APP_DIR/$item" ]] && backup_paths+=("$item"); done
tar -C "$APP_DIR" -czf "$backup" "${backup_paths[@]}" 2>/dev/null || fail "Could not create a rollback copy."
install -d -o root -g "$APP_NAME" -m 0750 "$APP_DIR" "$APP_DIR/src" "$APP_DIR/public" "$APP_DIR/public/assets"
install -o root -g "$APP_NAME" -m 0640 "$PROJECT_DIR/server.mjs" "$APP_DIR/server.mjs"
install -o root -g "$APP_NAME" -m 0640 "$PROJECT_DIR/package.json" "$APP_DIR/package.json"
install -o root -g "$APP_NAME" -m 0640 "$PROJECT_DIR/package-lock.json" "$APP_DIR/package-lock.json"
while IFS= read -r -d '' file; do
  relative="${file#"$PROJECT_DIR/src/"}"
  install -D -o root -g "$APP_NAME" -m 0640 "$file" "$APP_DIR/src/$relative"
done < <(find "$PROJECT_DIR/src" -maxdepth 1 -type f -name '*.mjs' ! -name '*.test.mjs' -print0)
for file in index.html app.js app.css login.html login.js login.css favicon.svg; do install -o root -g "$APP_NAME" -m 0640 "$PROJECT_DIR/public/$file" "$APP_DIR/public/$file"; done
if [[ -d "$PROJECT_DIR/public/assets" ]]; then
  while IFS= read -r -d '' file; do
    relative="${file#"$PROJECT_DIR/public/"}"
    install -D -o root -g "$APP_NAME" -m 0640 "$file" "$APP_DIR/$relative"
  done < <(find "$PROJECT_DIR/public/assets" -type f -print0)
fi
install -d -o root -g root -m 0755 /usr/local/lib/connecso-tools
install -o root -g root -m 0755 "$PROJECT_DIR/self-update.sh" /usr/local/lib/connecso-tools/self-update.sh
stage="installing panel dependencies"
write_status installing "" updateDependencies
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
NPM_BIN="$(dirname -- "$NODE_BIN")/npm"
[[ -x "$NPM_BIN" ]] || NPM_BIN="$(command -v npm || true)"
[[ -n "$NPM_BIN" ]] || fail "npm is required to install the local GeoIP reader."
"$NODE_BIN" "$NPM_BIN" ci --prefix "$APP_DIR" --omit=dev --ignore-scripts --no-audit --no-fund --fetch-retries=1 --fetch-timeout=90000 &
npm_pid=$!
(
  while kill -0 "$npm_pid" 2>/dev/null; do
    sleep 5
    kill -0 "$npm_pid" 2>/dev/null || break
    write_status installing "" updateDependencies || true
  done
) &
heartbeat_pid=$!
npm_exit=0
wait "$npm_pid" || npm_exit=$?
stop_heartbeat
if (( npm_exit != 0 )); then
  rm -rf -- "$APP_DIR/node_modules"
  tar -C "$APP_DIR" -xzf "$backup"
  rm -f -- "$backup"
  fail "Could not install the panel's GeoIP reader; the previous files were restored."
fi
chown -R root:"$APP_NAME" "$APP_DIR/node_modules"
find "$APP_DIR/node_modules" -type d -exec chmod 0750 {} +
find "$APP_DIR/node_modules" -type f -exec chmod 0640 {} +

stage="restarting and checking panel service"
write_status restarting "" updateRestarting
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
write_status complete "" updateComplete
status_written=1
