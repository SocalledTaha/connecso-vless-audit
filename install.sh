#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="vless-audit"
APP_DIR="/opt/vless-audit"
CONFIG_DIR="/etc/vless-audit"
DATA_DIR="/var/lib/vless-audit"
STATE_FILE="$CONFIG_DIR/install-state.env"
LEGACY_STATE_FILE="$DATA_DIR/install-state.env"
SERVICE_FILE="/etc/systemd/system/vless-audit.service"
ENV_FILE="$CONFIG_DIR/panel.env"
CERTBOT="/usr/bin/certbot"
ACTIVE_HTTP_SERVICES=()
TEMP_DIRS=()

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
CURL_PROGRESS=()
[[ -t 1 ]] && CURL_PROGRESS=(--progress-bar)

die() { printf 'Error: %s\n' "$*" >&2; exit 1; }
info() { printf '%s›%s %s\n' "$C_CYAN" "$C_RESET" "$*"; }
success() { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
step() { printf '\n%s[%s/%s]%s %s%s%s\n' "$C_CYAN" "$1" "$2" "$C_RESET" "$C_BOLD" "$3" "$C_RESET"; }
show_banner() {
  printf '\n%s╭──────────────────────────────────────────────────────────────╮%s\n' "$C_CYAN" "$C_RESET"
  printf '%s│%s  %sConnecso Outbound Audit%s  %s· server installer%s             %s│%s\n' "$C_CYAN" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET" "$C_CYAN" "$C_RESET"
  printf '%s╰──────────────────────────────────────────────────────────────╯%s\n' "$C_CYAN" "$C_RESET"
}
cleanup_temp_dirs() {
  local directory
  for directory in "${TEMP_DIRS[@]:-}"; do
    [[ -n "$directory" ]] || continue
    rm -rf -- "$directory" || true
  done
  return 0
}
run_apt_step() {
  local label="$1" log
  shift
  log="$(mktemp)"
  TEMP_DIRS+=("$log")
  info "$label"
  if "$@" >"$log" 2>&1; then
    rm -f -- "$log"
    TEMP_DIRS=()
    success "$label"
  else
    local status=$?
    printf 'Package operation failed; recent output follows:\n' >&2
    tail -n 40 "$log" >&2 || true
    die "$label failed with exit code $status."
  fi
}
save_state() {
  mkdir -p "$CONFIG_DIR"
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
  chown root:root "$STATE_FILE.tmp"
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
  ss -H -ltn "sport = :$1" 2>/dev/null | grep -q .
}
port_listeners() { ss -H -ltnp "sport = :$1" 2>/dev/null || true; }
certificate_valid() {
  local candidate="$1" live="/etc/letsencrypt/live/$1"
  [[ -s "$live/fullchain.pem" && -s "$live/privkey.pem" ]] \
    && openssl x509 -in "$live/fullchain.pem" -noout -checkhost "$candidate" >/dev/null 2>&1 \
    && openssl x509 -in "$live/fullchain.pem" -noout -checkend 2592000 >/dev/null 2>&1
}
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
  printf 'Temporarily stopping only the service(s) holding TCP/80: %s.\n' "${owners[*]}"
  for service in "${owners[@]}"; do systemctl stop "$service"; done
  for attempt in {1..20}; do
    port_listening 80 || return 0
    sleep 0.5
  done
  listeners="$(port_listeners 80)"
  die "TCP/80 remained occupied after stopping ${owners[*]}. Current listener: ${listeners:-unknown}. The stopped services will be restored automatically."
}
valid_domain() {
  local candidate="${1,,}" label
  local -a labels=()
  [[ ${#candidate} -le 253 && "$candidate" == *.* ]] || return 1
  [[ ! "$candidate" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || return 1
  IFS='.' read -r -a labels <<< "$candidate"
  for label in "${labels[@]}"; do
    [[ -n "$label" && ${#label} -le 63 && "$label" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]] || return 1
  done
}
restore_http_services() {
  local service
  for service in "${ACTIVE_HTTP_SERVICES[@]:-}"; do
    [[ -n "$service" ]] || continue
    systemctl start "$service" >/dev/null 2>&1 || printf 'Warning: could not restart %s; start it manually.\n' "$service" >&2
  done
  ACTIVE_HTTP_SERVICES=()
}
trap 'restore_http_services; cleanup_temp_dirs' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die 'Run this installer as root.'
command -v apt-get >/dev/null 2>&1 || die 'This installer currently supports Ubuntu and Debian.'
[[ -r /etc/os-release ]] || die 'Could not identify this Linux distribution.'
# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == ubuntu || "${ID:-}" == debian ]] || die "Unsupported Linux distribution: ${PRETTY_NAME:-unknown}. Use Ubuntu or Debian."
command -v ss >/dev/null 2>&1 || die 'The ss utility is required for safe port checks; install iproute2 and rerun.'
export NEEDRESTART_SUSPEND=1 DEBIAN_FRONTEND=noninteractive
SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$SOURCE_DIR/server.mjs" && -d "$SOURCE_DIR/src" && -d "$SOURCE_DIR/public" ]] || die 'Run install.sh from the extracted project directory.'
show_banner
mkdir -p "$DATA_DIR" "$CONFIG_DIR"
if [[ ! -e "$STATE_FILE" && -e "$LEGACY_STATE_FILE" ]]; then
  [[ -f "$LEGACY_STATE_FILE" && ! -L "$LEGACY_STATE_FILE" ]] || die 'The saved installer state is not a regular file; refusing to load it as root.'
  LEGACY_STATE_META="$(stat -c '%u:%a' "$LEGACY_STATE_FILE" 2>/dev/null || true)"
  [[ "$LEGACY_STATE_META" == '0:600' ]] || die 'The legacy installer state is not root-only; inspect it and rerun safely.'
  install -o root -g root -m 0600 "$LEGACY_STATE_FILE" "$STATE_FILE"
fi
if [[ -r "$STATE_FILE" ]]; then # shellcheck disable=SC1090
  [[ -f "$STATE_FILE" && ! -L "$STATE_FILE" && "$(stat -c '%u:%a' "$STATE_FILE")" == '0:600' ]] || die 'Installer state permissions are unsafe; refusing to source it as root.'
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
  while true; do
    ask_value DOMAIN 'Panel domain (DNS must point to this server)' 'audit.example.com'
    DOMAIN="${DOMAIN,,}"
    valid_domain "$DOMAIN" && break
    warn 'Enter a valid DNS hostname, for example audit.example.com.'
  done
  while true; do
    ask_value PORT 'Panel HTTPS port' '3006'
    if [[ "$PORT" =~ ^[0-9]{1,5}$ ]]; then PORT=$((10#$PORT)); else PORT=0; fi
    (( PORT >= 1 && PORT <= 65535 && PORT != 80 )) && break
    warn 'Choose a port from 1 to 65535; port 80 is reserved for certificate validation.'
  done
  if port_listening "$PORT"; then die "Port $PORT is already in use. Choose a free HTTPS port."; fi
  ask_value ADMIN_EMAIL "Email for Let's Encrypt certificate notices (optional)" ''
  [[ -z "$ADMIN_EMAIL" || "$ADMIN_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || die 'Enter a valid email address or leave it empty.'
  PANEL_PASSWORD="${PANEL_PASSWORD:-}"
  if [[ -z "$PANEL_PASSWORD" ]]; then read -r -s -p 'Admin password (leave empty to generate one): ' PANEL_PASSWORD; printf '\n'; fi
  [[ -n "$PANEL_PASSWORD" ]] || PANEL_PASSWORD="$(openssl rand -hex 24)"
  [[ "$PANEL_PASSWORD" =~ ^[A-Za-z0-9._@%+=:,!-]{12,128}$ ]] || die 'Use a 12–128 character password containing only letters, numbers, and . _ @ % + = : , ! -.'
  STAGE=1; save_state
else
  printf 'Resuming installer at saved stage %s for %s:%s.\n' "$STAGE" "$DOMAIN" "$PORT"
fi

if (( STAGE < 2 )); then
  step 1 5 'Preparing system packages'
  info 'Needrestart is suspended during package installation to avoid unrelated service restarts.'
  run_apt_step 'Refreshing package lists' apt-get update -o Acquire::Retries=3
  run_apt_step 'Installing required packages' apt-get install -y --no-install-recommends \
    ca-certificates curl xz-utils coreutils openssl certbot git iproute2 iputils-ping
  CERTBOT="$(command -v certbot)"
  command -v ss >/dev/null 2>&1 || die 'The iproute2 package was installed, but ss is still unavailable.'
  if port_listening "$PORT" && ! { systemctl is-active --quiet "$APP_NAME.service" 2>/dev/null && [[ "${VLESS_AUDIT_APPLY_UPDATE:-0}" == 1 ]]; }; then
    die "Port $PORT is already in use. Choose another panel port before installation."
  fi
  success 'System packages are ready; unrelated services were left running.'
  STAGE=2; save_state
fi

# A previous installer version may have remembered Node from /root/.nvm.
# The panel runs with ProtectHome=true, so reselect a system or bundled runtime.
if (( STAGE >= 3 )); then
  NODE_CANDIDATE="$NODE_BIN"
  NODE_REAL="$(readlink -f "$NODE_CANDIDATE" 2>/dev/null || true)"
  NODE_MAJOR=0
  case "$NODE_REAL" in /usr/*|/bin/*|"$APP_DIR/runtime"/*) NODE_MAJOR="$("$NODE_CANDIDATE" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf 0)" ;; esac
  if (( NODE_MAJOR < 18 )); then STAGE=2; save_state; fi
fi

if (( STAGE < 3 )); then
  step 2 5 'Preparing Node.js 22 LTS'
  NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
  NODE_MAJOR=0
  if [[ -n "$NODE_BIN" ]]; then
    NODE_REAL="$(readlink -f "$NODE_BIN" 2>/dev/null || true)"
    case "$NODE_REAL" in /usr/*|/bin/*|"$APP_DIR/runtime"/*) NODE_MAJOR="$($NODE_BIN -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf 0)" ;; *) NODE_MAJOR=0 ;; esac
  fi
  if (( NODE_MAJOR < 18 )); then
    MACHINE="$(uname -m)"
    case "$MACHINE" in x86_64|amd64) NODE_ARCH=x64 ;; aarch64|arm64) NODE_ARCH=arm64 ;; *) die "Unsupported CPU architecture: $MACHINE" ;; esac
    NODE_INDEX="$(mktemp)"
    TEMP_DIRS+=("$NODE_INDEX")
    if ! curl -fL --retry 3 --connect-timeout 15 https://nodejs.org/dist/index.tab -o "$NODE_INDEX"; then
      die 'Could not download the official Node.js version list.'
    fi
    NODE_VERSION="$(awk 'NR>1 && $1 ~ /^v22\./ {print $1; exit}' "$NODE_INDEX")"
    rm -f -- "$NODE_INDEX"
    TEMP_DIRS=()
    [[ "$NODE_VERSION" =~ ^v22\.[0-9]+\.[0-9]+$ ]] || die 'Could not find an official Node.js 22 release.'
    NODE_ARCHIVE="node-${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
    NODE_URL="https://nodejs.org/dist/${NODE_VERSION}"
    TEMP_DIR="$(mktemp -d)"
    TEMP_DIRS+=("$TEMP_DIR")
    info 'Downloading the official Node.js runtime and verifying its SHA-256 checksum.'
    curl -fL --retry 3 --connect-timeout 15 --max-time 300 "${CURL_PROGRESS[@]}" "$NODE_URL/$NODE_ARCHIVE" -o "$TEMP_DIR/$NODE_ARCHIVE"
    curl -fsSL --retry 3 --connect-timeout 15 "$NODE_URL/SHASUMS256.txt" -o "$TEMP_DIR/SHASUMS256.txt"
    EXPECTED_SHA="$(awk -v file="$NODE_ARCHIVE" '$2 == file || $2 == "*" file { print $1; exit }' "$TEMP_DIR/SHASUMS256.txt")"
    [[ "$EXPECTED_SHA" =~ ^[A-Fa-f0-9]{64}$ ]] || die 'The official Node.js checksum was not found.'
    printf '%s  %s\n' "$EXPECTED_SHA" "$TEMP_DIR/$NODE_ARCHIVE" | sha256sum -c -
    install -d -m 0755 "$APP_DIR/runtime"
    tar -xJf "$TEMP_DIR/$NODE_ARCHIVE" -C "$APP_DIR/runtime"
    NODE_BIN="$APP_DIR/runtime/node-${NODE_VERSION}-linux-${NODE_ARCH}/bin/node"
    rm -rf -- "$TEMP_DIR"
    TEMP_DIRS=()
  fi
  NODE_MAJOR="$($NODE_BIN -p 'Number(process.versions.node.split(".")[0])')"
  (( NODE_MAJOR >= 18 )) || die 'Node.js 18 or newer is required.'
  NODE_REAL="$(readlink -f "$NODE_BIN")"
  case "$NODE_REAL" in /usr/*|/bin/*|"$APP_DIR/runtime"/*) ;; *) die 'Node.js must be installed outside protected home directories.' ;; esac
  success "Node.js $($NODE_BIN --version) is ready."
  STAGE=3; save_state
fi

if (( STAGE < 4 )); then
  step 3 5 'Checking Xray runtime'
  XRAY_BIN="${XRAY_BIN:-}"
  if [[ -z "$XRAY_BIN" ]]; then
    for candidate in /usr/local/x-ui/bin/xray-linux-amd64 /usr/local/x-ui/bin/xray /usr/local/bin/xray /usr/bin/xray; do
      if [[ -x "$candidate" ]]; then XRAY_BIN="$candidate"; break; fi
    done
  fi
  if [[ -z "$XRAY_BIN" ]]; then
    XRAY_UNITS_BEFORE="$(systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '$1 == "xray.service" || $1 ~ /^xray@.*\.service$/ {print $1}' || true)"
    XRAY_ACTIVE_BEFORE="$(systemctl list-units --type=service --state=active --no-legend 2>/dev/null | awk '$1 == "xray.service" || $1 ~ /^xray@.*\.service$/ {print $1}' || true)"
    TEMP_XRAY="$(mktemp)"
    TEMP_DIRS+=("$TEMP_XRAY")
    curl -fsSL https://github.com/XTLS/Xray-install/raw/main/install-release.sh -o "$TEMP_XRAY"
    if bash "$TEMP_XRAY" install --no-update-service --manually-restart-later --without-geodata; then
      XRAY_INSTALL_STATUS=0
    else
      XRAY_INSTALL_STATUS=$?
    fi
    rm -f -- "$TEMP_XRAY"
    TEMP_DIRS=()
    for candidate in /usr/local/bin/xray /usr/bin/xray; do if [[ -x "$candidate" ]]; then XRAY_BIN="$candidate"; break; fi; done
    while IFS= read -r unit; do
      [[ -n "$unit" ]] || continue
      if ! grep -Fxq "$unit" <<< "$XRAY_ACTIVE_BEFORE"; then systemctl stop "$unit" >/dev/null 2>&1 || true; fi
      if ! grep -Fxq "$unit" <<< "$XRAY_UNITS_BEFORE"; then systemctl disable "$unit" >/dev/null 2>&1 || true; fi
    done < <(systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '$1 == "xray.service" || $1 ~ /^xray@.*\.service$/ {print $1}')
    if (( XRAY_INSTALL_STATUS != 0 )); then
      warn "The upstream installer returned $XRAY_INSTALL_STATUS; the Xray binary will be verified before continuing."
    fi
  fi
  [[ -x "$XRAY_BIN" ]] || die 'Xray executable was not found or installed.'
  XRAY_VERSION="$("$XRAY_BIN" version 2>&1 | head -n 1 || true)"
  [[ -n "$XRAY_VERSION" ]] || die "Xray binary could not run: $XRAY_BIN"
  success "Using $XRAY_BIN · $XRAY_VERSION"
  STAGE=4; save_state
fi

if (( STAGE < 5 )); then
  step 4 5 "Validating DNS and TLS for $DOMAIN"
  command -v getent >/dev/null 2>&1 || die 'getent is required to verify DNS.'
  RESOLVED_V4="$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | sort -u || true)"
  PUBLIC_IP="$(curl -4fsS --max-time 8 https://api.ipify.org || true)"
  [[ -n "$RESOLVED_V4" && -n "$PUBLIC_IP" ]] || die "Could not verify DNS A records and this server's public IPv4. Check DNS/network access, then rerun the installer."
  if ! grep -Fxq -- "$PUBLIC_IP" <<< "$RESOLVED_V4"; then
    printf 'Resolved IPv4 addresses for %s:\n%s\n' "$DOMAIN" "$RESOLVED_V4" >&2
    die "None of those A records matches this server's public IPv4 ($PUBLIC_IP). Point an A record directly to this server and rerun."
  fi
  if ! certificate_valid "$DOMAIN"; then
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
  certificate_valid "$DOMAIN" || die "No valid certificate was issued for $DOMAIN. Check DNS, firewall access to TCP/80, and the Certbot log."
  success "TLS certificate is valid for $DOMAIN."
  STAGE=5; save_state
fi

step 5 5 'Installing the panel and checking it is healthy'
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
set -Eeuo pipefail
STATE=/run/vless-audit-stopped-web-services
: > "$STATE"
ss -H -ltn 'sport = :80' | grep -q . || exit 0
owners=()
while IFS= read -r pid; do
  [[ "$pid" =~ ^[0-9]+$ && -r "/proc/$pid/cgroup" ]] || continue
  cgroup="$(cat "/proc/$pid/cgroup" 2>/dev/null || true)"
  unit="$(grep -oE '[^/]+\.service' <<< "$cgroup" | tail -n 1 || true)"
  [[ -n "$unit" ]] || continue
  systemctl is-active --quiet "$unit" || continue
  [[ " ${owners[*]} " == *" $unit "* ]] || owners+=("$unit")
done < <(ss -H -ltnp 'sport = :80' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
if ((${#owners[@]} == 0)); then
  echo "TCP/80 is occupied, but its systemd service owner could not be identified; no service was stopped." >&2
  exit 1
fi
restore_on_failure() {
  local status=$?
  if (( status != 0 )); then
    while IFS= read -r service; do [[ -n "$service" ]] && systemctl start "$service" || true; done < "$STATE"
    rm -f "$STATE"
  fi
}
trap restore_on_failure EXIT
printf '%s\n' "${owners[@]}" > "$STATE"
for service in "${owners[@]}"; do systemctl stop "$service"; done
for attempt in {1..20}; do
  ss -H -ltn 'sport = :80' | grep -q . || exit 0
  sleep 0.5
done
echo "TCP/80 remained occupied after stopping ${owners[*]}." >&2
exit 1
EOF
cat > /etc/letsencrypt/renewal-hooks/post/20-vless-audit <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
STATE=/run/vless-audit-stopped-web-services
if [[ -r "$STATE" ]]; then
  while IFS= read -r service; do [[ -n "$service" ]] && systemctl start "$service" || true; done < "$STATE"
  rm -f "$STATE"
fi
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

if command -v systemd-analyze >/dev/null 2>&1; then
  VERIFY_LOG="$(mktemp)"
  TEMP_DIRS+=("$VERIFY_LOG")
  if ! systemd-analyze verify "$SERVICE_FILE" /etc/systemd/system/vless-audit-self-update.path /etc/systemd/system/vless-audit-self-update.service >"$VERIFY_LOG" 2>&1; then
    cat "$VERIFY_LOG" >&2
    die 'One of the panel systemd units is invalid; the service was not restarted.'
  fi
  rm -f -- "$VERIFY_LOG"
  TEMP_DIRS=()
fi
systemctl daemon-reload
systemctl enable "$APP_NAME.service"
systemctl restart "$APP_NAME.service"
systemctl enable --now vless-audit-self-update.path
systemctl is-active --quiet vless-audit-self-update.path || die 'The panel is running, but the update watcher did not become active. Review the systemd error above and rerun the installer.'
HEALTHY=0
for attempt in {1..30}; do
  if systemctl is-active --quiet "$APP_NAME.service"; then
    HEALTH="$(curl -kfsS --max-time 3 --resolve "$DOMAIN:$PORT:127.0.0.1" "https://$DOMAIN:$PORT/api/health" 2>/dev/null || true)"
    if [[ "$HEALTH" == *'"ok":true'* ]]; then HEALTHY=1; break; fi
  fi
  sleep 1
done
if (( HEALTHY == 0 )); then
  printf '\nPanel health check failed. Recent service logs:\n' >&2
  journalctl -u "$APP_NAME.service" -n 40 --no-pager >&2 || true
  die 'The panel service did not pass its local HTTPS health check.'
fi
success 'Panel service and local HTTPS health check passed.'
STAGE=6; save_state
if [[ "${VLESS_AUDIT_APPLY_UPDATE:-0}" != 1 ]]; then
printf '\n%s╭──────────────────────────────────────────────────────────────╮%s\n' "$C_CYAN" "$C_RESET"
printf '%s│%s  %s✓  INSTALLATION COMPLETE%s                                  %s│%s\n' "$C_CYAN" "$C_RESET" "$C_GREEN" "$C_RESET" "$C_CYAN" "$C_RESET"
printf '%s╰──────────────────────────────────────────────────────────────╯%s\n' "$C_CYAN" "$C_RESET"
printf '\n  %sPanel URL%s       %s%shttps://%s:%s/%s\n' "$C_BOLD" "$C_RESET" "$C_CYAN" "$C_BOLD" "$DOMAIN" "$PORT" "$C_RESET"
printf '  %sLogin user%s      %sadmin%s\n' "$C_BOLD" "$C_RESET" "$C_GREEN" "$C_RESET"
printf '  %sAdmin password%s  %s%s%s\n' "$C_BOLD" "$C_RESET" "$C_YELLOW" "$PANEL_PASSWORD" "$C_RESET"
printf '\n  %sSave these login details before closing this terminal.%s\n' "$C_DIM" "$C_RESET"
printf '  %sOpen maintenance later with ConnecsoTools or CTS.%s\n' "$C_DIM" "$C_RESET"
printf '  %sThe installer resumes safely if rerun; audit history and credentials are preserved.%s\n' "$C_DIM" "$C_RESET"
printf '  %sUninstall: sudo bash %s/uninstall.sh%s\n' "$C_DIM" "$PROJECT_DIR" "$C_RESET"
else
  printf '\n%s✓ Panel update completed successfully.%s\n' "$C_GREEN" "$C_RESET"
  printf '  Panel URL: https://%s:%s/\n' "$DOMAIN" "$PORT"
fi
