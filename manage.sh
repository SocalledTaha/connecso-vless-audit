#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="vless-audit"
APP_DIR="/opt/vless-audit"
CONFIG_DIR="/etc/vless-audit"
DATA_DIR="/var/lib/vless-audit"
STATE_FILE="$DATA_DIR/install-state.env"
ENV_FILE="$CONFIG_DIR/panel.env"
SERVICE_FILE="/etc/systemd/system/$APP_NAME.service"
HOOK_DIR="/etc/letsencrypt/renewal-hooks"
CERTBOT="$(command -v certbot || printf /usr/bin/certbot)"
STOPPED_SERVICES=()

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_CYAN=$'\033[1;36m'
  C_GREEN=$'\033[1;32m'; C_YELLOW=$'\033[1;33m'; C_RED=$'\033[1;31m'; C_DIM=$'\033[2m'
else
  C_RESET=''; C_BOLD=''; C_CYAN=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_DIM=''
fi

say() { printf '%s\n' "$*"; }
ok() { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
fail() { printf '%sError:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; }
port_listening() { ss -H -ltn "sport = :$1" 2>/dev/null | grep -q .; }
port_listeners() { ss -H -ltnp "sport = :$1" 2>/dev/null || true; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || { fail 'Run ConnecsoTools with sudo.'; exit 1; }
[[ -r "$STATE_FILE" && -r "$ENV_FILE" ]] || { fail 'The panel installation or its state files are missing.'; exit 1; }
# These files are created by the root installer and mode-restricted.
# shellcheck disable=SC1090
source "$STATE_FILE"
# shellcheck disable=SC1090
source "$ENV_FILE"
DOMAIN="${DOMAIN:-}"
PORT="${PORT:-3006}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
PROJECT_DIR="${PROJECT_DIR:-}"

save_state() {
  install -d -m 0700 "$DATA_DIR"
  {
    printf 'STAGE=%q\n' "${STAGE:-6}"
    printf 'DOMAIN=%q\n' "$DOMAIN"
    printf 'PORT=%q\n' "$PORT"
    printf 'ADMIN_EMAIL=%q\n' "$ADMIN_EMAIL"
    printf 'PANEL_PASSWORD=%q\n' "${PANEL_PASSWORD:-}"
    printf 'NODE_BIN=%q\n' "${NODE_BIN:-}"
    printf 'XRAY_BIN=%q\n' "${XRAY_BIN:-}"
    printf 'PROJECT_DIR=%q\n' "$PROJECT_DIR"
  } > "$STATE_FILE.tmp"
  chmod 0600 "$STATE_FILE.tmp"
  mv -f "$STATE_FILE.tmp" "$STATE_FILE"
}

restore_web_services() {
  local service
  for service in "${STOPPED_SERVICES[@]:-}"; do
    [[ -n "$service" ]] || continue
    systemctl start "$service" >/dev/null 2>&1 || warn "Could not restart $service; start it manually."
  done
  STOPPED_SERVICES=()
}
trap 'restore_web_services' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

stop_http_services_if_needed() {
  local service pid cgroup unit attempt listeners
  local -a owners=()
  if ! port_listening 80; then return 0; fi
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
    fail "TCP/80 is occupied by a process not managed by a detectable systemd service. Current listener: ${listeners:-unknown}. No process was killed."
    return 1
  fi
  STOPPED_SERVICES+=("${owners[@]}")
  say "Temporarily stopping ${owners[*]} so the certificate authority can validate HTTP-01."
  for service in "${owners[@]}"; do systemctl stop "$service"; done
  for attempt in {1..20}; do
    if ! port_listening 80; then return 0; fi
    sleep 0.5
  done
  listeners="$(port_listeners 80)"
  fail "TCP/80 remained occupied after stopping ${owners[*]}. Current listener: ${listeners:-unknown}. The stopped services will be restored automatically."
  return 1
}

validate_domain() {
  local candidate="${1,,}"
  [[ "$candidate" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ && "$candidate" == *.* && "$candidate" != *..* ]] || return 1
  printf '%s' "$candidate"
}

verify_domain_dns() {
  local candidate="$1" public_ip resolved
  command -v getent >/dev/null 2>&1 || { fail 'getent is required to check DNS.'; return 1; }
  resolved="$(getent ahostsv4 "$candidate" | awk '{print $1}' | sort -u || true)"
  public_ip="$(curl -4fsS --max-time 8 https://api.ipify.org || true)"
  [[ -n "$resolved" && -n "$public_ip" ]] || { fail 'Could not read the domain A records or this server public IPv4.'; return 1; }
  if ! grep -Fxq -- "$public_ip" <<< "$resolved"; then
    say "A records found for $candidate:"
    say "$resolved"
    fail "None matches this server public IPv4 ($public_ip). Point a direct A record here, then retry."
    return 1
  fi
  ok "$candidate has an A record matching this server ($public_ip)."
}

request_certificate() {
  local candidate="$1" force="${2:-0}"; local -a args
  verify_domain_dns "$candidate" || return 1
  stop_http_services_if_needed || return 1
  args=(certonly --standalone --preferred-challenges http --non-interactive --agree-tos)
  if (( force )); then args+=(--force-renewal); else args+=(--keep-until-expiring); fi
  if [[ -n "$ADMIN_EMAIL" ]]; then args+=(--email "$ADMIN_EMAIL"); else args+=(--register-unsafely-without-email); fi
  args+=(-d "$candidate")
  if ! "$CERTBOT" "${args[@]}"; then
    restore_web_services
    return 1
  fi
  restore_web_services
  [[ -s "/etc/letsencrypt/live/$candidate/fullchain.pem" && -s "/etc/letsencrypt/live/$candidate/privkey.pem" ]] || { fail 'Certificate files were not created.'; return 1; }
}

sync_certificate() {
  local live="/etc/letsencrypt/live/$DOMAIN"
  [[ -s "$live/fullchain.pem" && -s "$live/privkey.pem" ]] || { fail "Certificate for $DOMAIN is not available."; return 1; }
  install -o root -g "$APP_NAME" -m 0640 "$live/fullchain.pem" "$CONFIG_DIR/server.crt"
  install -o root -g "$APP_NAME" -m 0640 "$live/privkey.pem" "$CONFIG_DIR/server.key"
}

write_deploy_hook() {
  install -d -m 0755 "$HOOK_DIR/deploy"
  cat > "$HOOK_DIR/deploy/20-vless-audit" <<EOF
#!/usr/bin/env bash
set -e
[[ "\${RENEWED_LINEAGE:-}" == "/etc/letsencrypt/live/$DOMAIN" ]] || exit 0
install -o root -g $APP_NAME -m 0640 "\$RENEWED_LINEAGE/fullchain.pem" "$CONFIG_DIR/server.crt"
install -o root -g $APP_NAME -m 0640 "\$RENEWED_LINEAGE/privkey.pem" "$CONFIG_DIR/server.key"
systemctl try-restart $APP_NAME.service
EOF
  chmod 0755 "$HOOK_DIR/deploy/20-vless-audit"
}

restart_service() {
  systemctl restart "$APP_NAME.service"
  sleep 1
  if systemctl is-active --quiet "$APP_NAME.service"; then ok 'Panel service is running.'; else fail 'Panel did not start; inspect its journal.'; return 1; fi
}

diagnose() {
  local active health cert_end public_ip resolved
  say "\n${C_BOLD}Panel diagnostics${C_RESET}"
  active="$(systemctl is-active "$APP_NAME.service" 2>/dev/null || true)"
  if [[ "$active" == active ]]; then ok 'Panel service: active'; else fail "Panel service: ${active:-unknown}"; fi
  if port_listening "$PORT"; then ok "TCP $PORT is listening."; else fail "Nothing is listening on TCP $PORT."; fi
  health="$(curl -kfsS --max-time 5 --resolve "$DOMAIN:$PORT:127.0.0.1" "https://$DOMAIN:$PORT/api/health" 2>/dev/null || true)"
  if [[ "$health" == *'"ok":true'* ]]; then ok 'Local HTTPS health check passed.'; else fail 'Local HTTPS health check did not return healthy.'; fi
  if [[ -s "$CONFIG_DIR/server.crt" ]]; then
    cert_end="$(openssl x509 -in "$CONFIG_DIR/server.crt" -noout -enddate 2>/dev/null | cut -d= -f2- || true)"
    [[ -n "$cert_end" ]] && say "Certificate expires: $cert_end" || fail 'Could not read the installed certificate.'
  else fail 'Installed certificate file is missing.'; fi
  public_ip="$(curl -4fsS --max-time 8 https://api.ipify.org || true)"
  resolved="$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | sort -u || true)"
  say "Public IPv4: ${public_ip:-unavailable}"
  say "Domain A records: ${resolved//$'\n'/, }"
  say "Disk: $(df -h / | awk 'NR==2 {print $4 " free of " $2}')"
  say "Memory: $(free -h | awk '/^Mem:/ {print $3 " used of " $2}')"
  say "\nRecent service logs:"
  journalctl -u "$APP_NAME.service" -n 40 --no-pager || true
}

change_port() {
  local new_port
  read -r -p "New HTTPS port [$PORT]: " new_port
  new_port="${new_port:-$PORT}"
  [[ "$new_port" =~ ^[0-9]+$ ]] && (( new_port >= 1 && new_port <= 65535 )) || { fail 'Port must be between 1 and 65535.'; return 1; }
  if [[ "$new_port" != "$PORT" ]] && port_listening "$new_port"; then fail "TCP $new_port is already in use."; return 1; fi
  local tmp; tmp="$(mktemp "$CONFIG_DIR/panel.env.XXXXXX")"
  awk -v p="$new_port" '{ if ($0 ~ /^PORT=/) print "PORT=" p; else print }' "$ENV_FILE" > "$tmp"
  chown root:"$APP_NAME" "$tmp"; chmod 0640 "$tmp"; mv -f "$tmp" "$ENV_FILE"
  PORT="$new_port"; save_state
  restart_service
  ok "Panel URL: https://$DOMAIN:$PORT/"
  warn 'Open the new port in the server firewall/security group if it is not already allowed.'
}

change_domain() {
  local raw candidate old_domain
  old_domain="$DOMAIN"
  read -r -p 'New panel domain: ' raw
  candidate="$(validate_domain "$raw")" || { fail 'Enter a valid DNS hostname.'; return 1; }
  [[ "$candidate" == "$DOMAIN" ]] && { warn 'That is already the configured domain.'; return 0; }
  say "First, the new domain must point directly to this server and pass certificate issuance."
  request_certificate "$candidate" 0 || return 1
  DOMAIN="$candidate"
  save_state
  write_deploy_hook
  sync_certificate
  restart_service
  ok "Panel now uses https://$DOMAIN:$PORT/"
  warn "The previous certificate for $old_domain is left in Certbot; it is not removed automatically."
}

renew_certificate() {
  if ! "$CERTBOT" renew --cert-name "$DOMAIN"; then return 1; fi
  sync_certificate
  restart_service
}

force_reissue_certificate() {
  request_certificate "$DOMAIN" 1 || return 1
  sync_certificate
  restart_service
  ok "Certificate reissued for $DOMAIN."
}

change_password() {
  local first second tmp
  read -r -s -p 'New admin password (12–128 letters, numbers, . _ @ % + = : -): ' first; printf '\n'
  [[ "$first" =~ ^[A-Za-z0-9._@%+=:-]{12,128}$ ]] || { fail 'Password format or length is not accepted.'; return 1; }
  read -r -s -p 'Repeat new admin password: ' second; printf '\n'
  [[ "$first" == "$second" ]] || { fail 'Passwords do not match.'; return 1; }
  tmp="$(mktemp "$CONFIG_DIR/panel.env.XXXXXX")"
  awk '!/^PANEL_PASSWORD=/' "$ENV_FILE" > "$tmp"
  printf 'PANEL_PASSWORD=%s\n' "$first" >> "$tmp"
  chown root:"$APP_NAME" "$tmp"; chmod 0640 "$tmp"; mv -f "$tmp" "$ENV_FILE"
  PANEL_PASSWORD="$first"; save_state
  restart_service
  printf '\n%sNew admin password:%s %s%s%s\n' "$C_BOLD" "$C_RESET" "$C_YELLOW" "$first" "$C_RESET"
}

update_panel() {
  [[ -n "$PROJECT_DIR" && -d "$PROJECT_DIR/.git" && -f "$PROJECT_DIR/install.sh" ]] || {
    fail 'Update source is not available. Clone the project and run its installer once to register the source directory.'
    return 1
  }
  say "Updating project files from GitHub in $PROJECT_DIR …"
  git -c safe.directory="$PROJECT_DIR" -C "$PROJECT_DIR" pull --ff-only origin main || { fail 'Git update failed; panel files were left unchanged.'; return 1; }
  VLESS_AUDIT_APPLY_UPDATE=1 bash "$PROJECT_DIR/install.sh"
}

show_menu() {
  clear 2>/dev/null || true
  printf '%s╭──────────────────────────────────────────────────────────────╮%s\n' "$C_CYAN" "$C_RESET"
  printf '%s│%s  %sConnecsoTools%s  %s· panel maintenance%s                         %s│%s\n' "$C_CYAN" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET" "$C_CYAN" "$C_RESET"
  printf '%s╰──────────────────────────────────────────────────────────────╯%s\n' "$C_CYAN" "$C_RESET"
  printf '  Panel: %shttps://%s:%s/%s\n\n' "$C_CYAN" "$DOMAIN" "$PORT" "$C_RESET"
  printf '  %s1%s  Renew SSL\n' "$C_GREEN" "$C_RESET"
  printf '  %s2%s  Reissue SSL\n' "$C_GREEN" "$C_RESET"
  printf '  %s3%s  Change domain\n' "$C_GREEN" "$C_RESET"
  printf '  %s4%s  Change port\n' "$C_GREEN" "$C_RESET"
  printf '  %s5%s  Diagnostics · 40 logs\n' "$C_GREEN" "$C_RESET"
  printf '  %s6%s  Update panel\n' "$C_GREEN" "$C_RESET"
  printf '  %s7%s  Restart panel\n' "$C_GREEN" "$C_RESET"
  printf '  %s8%s  Change admin password\n' "$C_GREEN" "$C_RESET"
  printf '  %s0%s  Exit\n\n' "$C_GREEN" "$C_RESET"
}

while true; do
  show_menu
  read -r -p 'Choose an option: ' choice
  case "$choice" in
    1) renew_certificate || warn 'Certificate renewal failed; see the error above.'; read -r -p 'Press Enter to continue…' _ ;;
    2) force_reissue_certificate || warn 'Certificate reissue failed; see the error above.'; read -r -p 'Press Enter to continue…' _ ;;
    3) change_domain || warn 'Domain change was not completed.'; read -r -p 'Press Enter to continue…' _ ;;
    4) change_port || warn 'Port change was not completed.'; read -r -p 'Press Enter to continue…' _ ;;
    5) diagnose; read -r -p 'Press Enter to continue…' _ ;;
    6) update_panel || warn 'Update was not completed.'; read -r -p 'Press Enter to continue…' _ ;;
    7) restart_service || true; read -r -p 'Press Enter to continue…' _ ;;
    8) change_password || warn 'Password was not changed.'; read -r -p 'Press Enter to continue…' _ ;;
    0) say 'Goodbye.'; exit 0 ;;
    *) warn 'Choose one of the listed options.'; sleep 1 ;;
  esac
done
