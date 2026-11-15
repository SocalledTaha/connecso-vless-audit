#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="vless-audit"
APP_DIR="/opt/vless-audit"
CONFIG_DIR="/etc/vless-audit"
DATA_DIR="/var/lib/vless-audit"
STATE_FILE="$DATA_DIR/install-state.env"
SERVICE_FILE="/etc/systemd/system/vless-audit.service"
ENV_FILE="$CONFIG_DIR/panel.env"
CERTBOT="/usr/bin/certbot"
ACTIVE_HTTP_SERVICES=()

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_CYAN=$'\033[1;36m'
  C_GREEN=$'\033[1;32m'
  C_YELLOW=$'\033[1;33m'
  C_DIM=$'\033[2m'
else
  C_RESET=''; C_BOLD=''; C_CYAN=''; C_GREEN=''; C_YELLOW=''; C_DIM=''
fi

die() { printf 'Error: %s\n' "$*" >&2; exit 1; }
save_state() {
  install -d -m 0700 "$DATA_DIR"
  {
    printf 'STAGE=%q\n' "${STAGE:-0}"
    printf 'DOMAIN=%q\n' "${DOMAIN:-}"
    printf 'PORT=%q\n' "${PORT:-}"
    printf 'ADMIN_EMAIL=%q\n' "${ADMIN_EMAIL:-}"
    printf 'PANEL_PASSWORD=%q\n' "${PANEL_PASSWORD:-}"
    printf 'NODE_BIN=%q\n' "${NODE_BIN:-}"
    printf 'XRAY_BIN=%q\n' "${XRAY_BIN:-}"
    printf 'PROJECT_DIR=%q\n' "${PROJECT_DIR:-$SOURCE_DIR}"
  } > "$STATE_FILE.tmp"
  chmod 0600 "$STATE_FILE.tmp"
  mv -f "$STATE_FILE.tmp" "$STATE_FILE"
}
ask_value() {
  local name="$1" prompt="$2" default="$3" current="${!1:-}" answer
  if [[ -n "$current" ]]; then
    read -r -p "$prompt [$current]: " answer
    printf -v "$name" '%s' "${answer:-$current}"
  else
    read -r -p "$prompt [$default]: " answer
    printf -v "$name" '%s' "${answer:-$default}"
  fi
}
port_listening() {
  command -v ss >/dev/null 2>&1 && ss -H -ltn "sport = :$1" | grep -q .
}
port_listeners() { ss -H -ltnp "sport = :$1" 2>/dev/null || true; }
stop_http_services_if_needed() {
  local service pid cgroup unit attempt listeners
  local -a owners=()
  port_listening 80 || return 0
  while read -r pid; do
    [[ "$pid" =~ ^[0-9]+$ && -r "/proc/$pid/cgroup" ]] || continue
    cgroup="$(cat "/proc/$pid/cgroup" 2>/dev/null || true)"
    unit="$(grep -oE '[^/]+\.service' <<< "$cgroup" | tail -n 1 || true)"
    [[ -n "$unit" ]] || continue
    systemctl is-active --quiet "$unit" || continue
    [[ " ${owners[*]} " == *" $unit "* ]] || owners+=("$unit")
  done < <(port_listeners 80 | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
  if ((${#owners[@]} == 0)); then
    listeners="$(port_listeners 80)"
    die "TCP/80 is still occupied by a process not managed by a detectable systemd service. Current listener: ${listeners:-unknown}. Stop or reconfigure it, then rerun; no process was killed."
  fi
  ACTIVE_HTTP_SERVICES+=("${owners[@]}")
  printf 'Temporarily stopping: %s (HTTP-01 needs TCP/80).\n' "${owners[*]}"
  for service in "${owners[@]}"; do systemctl stop "$service"; done
  for attempt in {1..20}; do
    port_listening 80 || return 0
    sleep 0.5
  done
  listeners="$(port_listeners 80)"
  die "TCP/80 remained occupied after stopping ${owners[*]}. Current listener: ${listeners:-unknown}. The stopped services will be restored automatically."
}
restore_http_services() {
  local service
  for service in "${ACTIVE_HTTP_SERVICES[@]:-}"; do
    [[ -n "$service" ]] || continue
    systemctl start "$service" >/dev/null 2>&1 || printf 'Warning: could not restart %s; start it manually.\n' "$service" >&2
  done
  ACTIVE_HTTP_SERVICES=()
}
trap 'restore_http_services' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die 'Run this installer as root.'
command -v apt-get >/dev/null 2>&1 || die 'This installer currently supports Ubuntu and Debian.'
SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$SOURCE_DIR/server.mjs" && -d "$SOURCE_DIR/src" && -d "$SOURCE_DIR/public" ]] || die 'Run install.sh from the extracted project directory.'
install -d -m 0700 "$DATA_DIR"
if [[ -r "$STATE_FILE" ]]; then # shellcheck disable=SC1090
  source "$STATE_FILE"
fi
STAGE="${STAGE:-0}"
PROJECT_DIR="${PROJECT_DIR:-$SOURCE_DIR}"

# Once installed, rerunning the installer opens the maintenance menu. The
# update action sets VLESS_AUDIT_APPLY_UPDATE=1 to apply the pulled files.
if (( STAGE >= 6 )) && [[ "${VLESS_AUDIT_APPLY_UPDATE:-0}" != 1 && -x /usr/local/bin/ConnecsoTools ]]; then
  exec /usr/local/bin/ConnecsoTools
fi

if (( STAGE < 1 )); then
  ask_value DOMAIN 'Panel subdomain (must resolve directly to this server)' 'audit.example.com'
  DOMAIN="${DOMAIN,,}"
  [[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ && "$DOMAIN" == *.* && "$DOMAIN" != *..* ]] || die 'Enter a valid DNS hostname.'
  ask_value PORT 'Panel HTTPS port' '3006'
  [[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1 && PORT <= 65535 )) || die 'Port must be between 1 and 65535.'
  if port_listening "$PORT"; then die "Port $PORT is already in use. Choose a free HTTPS port."; fi
  ask_value ADMIN_EMAIL "Email for Let's Encrypt certificate notices (optional)" ''
  PANEL_PASSWORD="${PANEL_PASSWORD:-}"
  if [[ -z "$PANEL_PASSWORD" ]]; then read -r -s -p 'Admin password (leave empty to generate one): ' PANEL_PASSWORD; printf '\n'; fi
  [[ -n "$PANEL_PASSWORD" ]] || PANEL_PASSWORD="$(openssl rand -hex 24)"
  [[ "$PANEL_PASSWORD" =~ ^[A-Za-z0-9._@%+=:,!-]{12,128}$ ]] || die 'Use a 12–128 character password containing only letters, numbers, and . _ @ % + = : , ! -.'
  STAGE=1; save_state
else
  printf 'Resuming installer at saved stage %s for %s:%s.\n' "$STAGE" "$DOMAIN" "$PORT"
fi

if (( STAGE < 2 )); then
  printf '\n[1/5] Installing required system packages…\n'
  apt-get update
  NEEDRESTART_MODE=l DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl xz-utils coreutils openssl certbot git iputils-ping
  CERTBOT="$(command -v certbot)"
  STAGE=2; save_state
fi

if (( STAGE < 3 )); then
  printf '\n[2/5] Preparing Node.js…\n'
  NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
  NODE_MAJOR=0
  if [[ -n "$NODE_BIN" ]]; then NODE_MAJOR="$($NODE_BIN -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf 0)"; fi
  if (( NODE_MAJOR < 18 )); then
    MACHINE="$(uname -m)"
    case "$MACHINE" in x86_64|amd64) NODE_ARCH=x64 ;; aarch64|arm64) NODE_ARCH=arm64 ;; *) die "Unsupported CPU architecture: $MACHINE" ;; esac
    NODE_INDEX="$(mktemp)"
    if ! curl -fsSL https://nodejs.org/dist/index.tab -o "$NODE_INDEX"; then
      rm -f -- "$NODE_INDEX"
      die 'Could not download the official Node.js version list.'
    fi
    NODE_VERSION="$(awk 'NR>1 && $1 ~ /^v22\./ {print $1; exit}' "$NODE_INDEX")"
    rm -f -- "$NODE_INDEX"
    [[ "$NODE_VERSION" =~ ^v22\.[0-9]+\.[0-9]+$ ]] || die 'Could not find an official Node.js 22 release.'
    NODE_ARCHIVE="node-${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
    NODE_URL="https://nodejs.org/dist/${NODE_VERSION}"
    TEMP_DIR="$(mktemp -d)"
    curl -fsSL "$NODE_URL/$NODE_ARCHIVE" -o "$TEMP_DIR/$NODE_ARCHIVE"
    curl -fsSL "$NODE_URL/SHASUMS256.txt" -o "$TEMP_DIR/SHASUMS256.txt"
    (cd "$TEMP_DIR" && grep "  $NODE_ARCHIVE$" SHASUMS256.txt | sha256sum -c -)
    install -d -m 0755 "$APP_DIR/runtime"
    tar -xJf "$TEMP_DIR/$NODE_ARCHIVE" -C "$APP_DIR/runtime"
    NODE_BIN="$APP_DIR/runtime/node-${NODE_VERSION}-linux-${NODE_ARCH}/bin/node"
    rm -rf -- "$TEMP_DIR"
  fi
  NODE_MAJOR="$($NODE_BIN -p 'Number(process.versions.node.split(".")[0])')"
  (( NODE_MAJOR >= 18 )) || die 'Node.js 18 or newer is required.'
  STAGE=3; save_state
fi

if (( STAGE < 4 )); then
  printf '\n[3/5] Locating Xray without changing any existing Xray service…\n'
  XRAY_BIN="${XRAY_BIN:-}"
  if [[ -z "$XRAY_BIN" ]]; then
    for candidate in /usr/local/x-ui/bin/xray-linux-amd64 /usr/local/x-ui/bin/xray /usr/local/bin/xray /usr/bin/xray; do
      if [[ -x "$candidate" ]]; then XRAY_BIN="$candidate"; break; fi
    done
  fi
  if [[ -z "$XRAY_BIN" ]]; then
    TEMP_XRAY="$(mktemp)"
    curl -fsSL https://github.com/XTLS/Xray-install/raw/main/install-release.sh -o "$TEMP_XRAY"
    bash "$TEMP_XRAY" install --no-update-service
    rm -f -- "$TEMP_XRAY"
    for candidate in /usr/local/bin/xray /usr/bin/xray; do if [[ -x "$candidate" ]]; then XRAY_BIN="$candidate"; break; fi; done
  fi
  [[ -x "$XRAY_BIN" ]] || die 'Xray executable was not found or installed.'
  STAGE=4; save_state
fi

if (( STAGE < 5 )); then
  printf '\n[4/5] Requesting TLS certificate for %s…\n' "$DOMAIN"
  command -v getent >/dev/null 2>&1 || die 'getent is required to verify DNS.'
  RESOLVED_V4="$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | sort -u || true)"
  PUBLIC_IP="$(curl -4fsS --max-time 8 https://api.ipify.org || true)"
  [[ -n "$RESOLVED_V4" && -n "$PUBLIC_IP" ]] || die "Could not verify DNS A records and this server's public IPv4. Check DNS/network access, then rerun the installer."
  if ! grep -Fxq -- "$PUBLIC_IP" <<< "$RESOLVED_V4"; then
    printf 'Resolved IPv4 addresses for %s:\n%s\n' "$DOMAIN" "$RESOLVED_V4" >&2
    die "None of those A records matches this server's public IPv4 ($PUBLIC_IP). Point an A record directly to this server and rerun."
  fi
  if ! "$CERTBOT" certificates 2>/dev/null | grep -Fq "Domains: $DOMAIN"; then
    # HTTP-01 standalone always binds TCP/80. Stop the systemd service(s)
    # owning the actual listeners and verify the port is free before Certbot.
    stop_http_services_if_needed
    if [[ -n "$ADMIN_EMAIL" ]]; then
      "$CERTBOT" certonly --standalone --preferred-challenges http --non-interactive --agree-tos --email "$ADMIN_EMAIL" -d "$DOMAIN"
    else
      "$CERTBOT" certonly --standalone --preferred-challenges http --non-interactive --agree-tos --register-unsafely-without-email -d "$DOMAIN"
    fi
    restore_http_services
  fi
  CERT_LIVE="/etc/letsencrypt/live/$DOMAIN"
  [[ -s "$CERT_LIVE/fullchain.pem" && -s "$CERT_LIVE/privkey.pem" ]] || die 'Certificate files were not created.'
  STAGE=5; save_state
fi

printf '\n[5/5] Installing/updating the panel files and service…\n'
if ! getent group "$APP_NAME" >/dev/null; then groupadd --system "$APP_NAME"; fi
if ! id "$APP_NAME" >/dev/null 2>&1; then useradd --system --gid "$APP_NAME" --home-dir "$DATA_DIR" --shell /usr/sbin/nologin "$APP_NAME"; fi
install -d -o root -g "$APP_NAME" -m 0750 "$APP_DIR" "$APP_DIR/src" "$APP_DIR/public" "$APP_DIR/public/assets" "$CONFIG_DIR"
install -d -o "$APP_NAME" -g "$APP_NAME" -m 0750 "$DATA_DIR" "$DATA_DIR/results"
install -o root -g "$APP_NAME" -m 0640 "$SOURCE_DIR/package.json" "$SOURCE_DIR/package-lock.json" "$APP_DIR/"
NPM_BIN="$(dirname -- "$NODE_BIN")/npm"
[[ -x "$NPM_BIN" ]] || NPM_BIN="$(command -v npm || true)"
[[ -n "$NPM_BIN" ]] || die 'npm is required to install the local GeoIP reader.'
"$NODE_BIN" "$NPM_BIN" ci --prefix "$APP_DIR" --omit=dev --ignore-scripts --no-audit --no-fund
chown -R root:"$APP_NAME" "$APP_DIR/node_modules"
find "$APP_DIR/node_modules" -type d -exec chmod 0750 {} +
find "$APP_DIR/node_modules" -type f -exec chmod 0640 {} +
for file in server.mjs; do install -o root -g "$APP_NAME" -m 0640 "$SOURCE_DIR/$file" "$APP_DIR/$file"; done
while IFS= read -r -d '' file; do
  relative="${file#"$SOURCE_DIR/src/"}"
  install -D -o root -g "$APP_NAME" -m 0640 "$file" "$APP_DIR/src/$relative"
done < <(find "$SOURCE_DIR/src" -maxdepth 1 -type f -name '*.mjs' ! -name '*.test.mjs' -print0)
for file in index.html app.js app.css login.html login.js login.css favicon.svg; do install -o root -g "$APP_NAME" -m 0640 "$SOURCE_DIR/public/$file" "$APP_DIR/public/$file"; done
if [[ -d "$SOURCE_DIR/public/assets" ]]; then
  while IFS= read -r -d '' file; do
    relative="${file#"$SOURCE_DIR/public/"}"
    install -D -o root -g "$APP_NAME" -m 0640 "$file" "$APP_DIR/public/$relative"
  done < <(find "$SOURCE_DIR/public/assets" -type f -print0)
fi

install -d -o root -g root -m 0755 /usr/local/lib/connecso-tools
install -o root -g root -m 0755 "$SOURCE_DIR/manage.sh" /usr/local/lib/connecso-tools/manage.sh
cat > /usr/local/bin/ConnecsoTools <<'EOF'
#!/usr/bin/env bash
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then exec sudo /usr/local/bin/ConnecsoTools "$@"; fi
exec /usr/bin/env bash /usr/local/lib/connecso-tools/manage.sh "$@"
EOF
chmod 0755 /usr/local/bin/ConnecsoTools
ln -sf /usr/local/bin/ConnecsoTools /usr/local/bin/connecsotools
ln -sf /usr/local/bin/ConnecsoTools /usr/local/bin/CONNECSOTOOLS
for alias in CTS cts Cts cTs ctS CTs CtS cTS; do
  ln -sf /usr/local/bin/ConnecsoTools "/usr/local/bin/$alias"
done

CERT_LIVE="/etc/letsencrypt/live/$DOMAIN"
install -o root -g "$APP_NAME" -m 0640 "$CERT_LIVE/fullchain.pem" "$CONFIG_DIR/server.crt"
install -o root -g "$APP_NAME" -m 0640 "$CERT_LIVE/privkey.pem" "$CONFIG_DIR/server.key"
umask 077
if [[ ! -s "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
HOST=0.0.0.0
PORT=$PORT
PANEL_PASSWORD=$PANEL_PASSWORD
XRAY_BIN=$XRAY_BIN
CERT_FILE=$CONFIG_DIR/server.crt
KEY_FILE=$CONFIG_DIR/server.key
RESULTS_DIR=$DATA_DIR/results
EOF
else
  sed -i "s|^PORT=.*|PORT=$PORT|; s|^XRAY_BIN=.*|XRAY_BIN=$XRAY_BIN|" "$ENV_FILE"
fi
chown root:"$APP_NAME" "$ENV_FILE"; chmod 0640 "$ENV_FILE"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=VLESS outbound checker
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=$APP_NAME
Group=$APP_NAME
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN $APP_DIR/server.mjs
Restart=on-failure
RestartSec=3
UMask=0027
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR /tmp
RestrictSUIDSGID=true
LockPersonality=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
TasksMax=128
LimitNOFILE=8192
[Install]
WantedBy=multi-user.target
EOF
chmod 0644 "$SERVICE_FILE"

# Authenticated in-panel updates are handed to a small root-owned updater.
# The web service only creates a request file; the updater validates the
# configured GitHub remote before replacing panel files and restarting it.
install -o root -g root -m 0755 "$SOURCE_DIR/self-update.sh" /usr/local/lib/connecso-tools/self-update.sh
cat > /etc/systemd/system/vless-audit-self-update.service <<EOF
[Unit]
Description=Connecso panel self-update worker
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
User=root
Group=root
TimeoutStartSec=10min
ExecStart=/usr/local/lib/connecso-tools/self-update.sh
ProtectSystem=strict
ProtectHome=false
PrivateTmp=true
ReadWritePaths="$APP_DIR" "$DATA_DIR" "$PROJECT_DIR" /usr/local/lib/connecso-tools
EOF
cat > /etc/systemd/system/vless-audit-self-update.path <<EOF
[Unit]
Description=Watch for authenticated Connecso panel update requests
[Path]
PathExists=$DATA_DIR/results/update-request.json
Unit=vless-audit-self-update.service
[Install]
WantedBy=multi-user.target
EOF
chmod 0644 /etc/systemd/system/vless-audit-self-update.{service,path}

# Certbot renewal hooks briefly free TCP/80 and then refresh the panel's copy.
install -d -m 0755 /etc/letsencrypt/renewal-hooks/pre /etc/letsencrypt/renewal-hooks/post /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/pre/20-vless-audit <<'EOF'
#!/usr/bin/env bash
set -e
STATE=/run/vless-audit-stopped-web-services
: > "$STATE"
ss -H -ltn 'sport = :80' | grep -q . || exit 0
for svc in apache2 nginx caddy lighttpd; do
  if systemctl is-active --quiet "$svc" && systemctl list-units --type=service --state=active --no-legend | awk '{print $1}' | grep -Fxq "$svc.service"; then
    echo "$svc" >> "$STATE"
    systemctl stop "$svc"
  fi
done
EOF
cat > /etc/letsencrypt/renewal-hooks/post/20-vless-audit <<'EOF'
#!/usr/bin/env bash
set -e
STATE=/run/vless-audit-stopped-web-services
if [[ -r "$STATE" ]]; then while IFS= read -r svc; do [[ -n "$svc" ]] && systemctl start "$svc" || true; done < "$STATE"; rm -f "$STATE"; fi
EOF
cat > /etc/letsencrypt/renewal-hooks/deploy/20-vless-audit <<EOF
#!/usr/bin/env bash
set -e
[[ "\${RENEWED_LINEAGE:-}" == "/etc/letsencrypt/live/$DOMAIN" ]] || exit 0
install -o root -g $APP_NAME -m 0640 "\$RENEWED_LINEAGE/fullchain.pem" "$CONFIG_DIR/server.crt"
install -o root -g $APP_NAME -m 0640 "\$RENEWED_LINEAGE/privkey.pem" "$CONFIG_DIR/server.key"
systemctl try-restart $APP_NAME.service
EOF
chmod 0755 /etc/letsencrypt/renewal-hooks/{pre,post,deploy}/20-vless-audit

systemctl daemon-reload
systemctl enable --now "$APP_NAME.service"
systemctl restart "$APP_NAME.service"
if ! systemctl enable --now vless-audit-self-update.path; then
  printf '\nWarning: the panel is running, but automatic in-panel updates could not be enabled.\n' >&2
  if command -v systemd-analyze >/dev/null 2>&1; then
    systemd-analyze verify /etc/systemd/system/vless-audit-self-update.path /etc/systemd/system/vless-audit-self-update.service 2>&1 || true
  fi
  systemctl status --no-pager --full vless-audit-self-update.path 2>&1 || true
  journalctl -u vless-audit-self-update.path -n 12 --no-pager 2>&1 || true
fi
STAGE=6; save_state
printf '\n%s╭──────────────────────────────────────────────────────────────╮%s\n' "$C_CYAN" "$C_RESET"
printf '%s│%s  %s✓  INSTALLATION COMPLETE%s                                  %s│%s\n' "$C_CYAN" "$C_RESET" "$C_GREEN" "$C_RESET" "$C_CYAN" "$C_RESET"
printf '%s╰──────────────────────────────────────────────────────────────╯%s\n' "$C_CYAN" "$C_RESET"
printf '\n  %sPanel URL%s       %s%shttps://%s:%s/%s\n' "$C_BOLD" "$C_RESET" "$C_CYAN" "$C_BOLD" "$DOMAIN" "$PORT" "$C_RESET"
printf '  %sLogin user%s      %sadmin%s\n' "$C_BOLD" "$C_RESET" "$C_GREEN" "$C_RESET"
printf '  %sAdmin password%s  %s%s%s\n' "$C_BOLD" "$C_RESET" "$C_YELLOW" "$PANEL_PASSWORD" "$C_RESET"
printf '\n  %sSave these login details before closing this terminal.%s\n' "$C_DIM" "$C_RESET"
printf '  %sRerunning the installer preserves the results and password.%s\n' "$C_DIM" "$C_RESET"
printf '  %sRemove %s only after confirming the panel works and saving the password.%s\n' "$C_DIM" "$STATE_FILE" "$C_RESET"
