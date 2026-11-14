# Connecso VLESS Audit

A small self-hosted tool for checking VLESS subscription routes and exporting tested TLS/Reality outbounds as a direct JSON array for compatible panels.

## What it does

- Reads a subscription URL or pasted text, including Base64 subscriptions.
- Tests VLESS routes with TLS or Reality through Xray and reports HTTPS response time (RTT/TTFB), exit IP, and estimated exit country.
- Runs selected HTTPS reachability checks for Gemini, YouTube, Instagram, and Telegram.
- Checks routes in batches of 10 or 20 using one temporary Xray process per batch; it does not replace or reconfigure any existing Xray service.
- Saves audit history locally, supports reopening and rescanning prior jobs, and has optional per-route ping and five-second download checks.
- Filters, sorts, finds duplicates, selects routes, validates VLESS outbound fields, and copies or downloads a direct JSON array grouped by country or selection.
- Includes Persian/English, light/dark themes, and a protected admin login.

The panel is export-only: it does not write outbounds, clients, or routing rules into another panel.

## Requirements

- Ubuntu or Debian server with root access.
- A DNS hostname resolving directly to the server's public IPv4 address.
- Inbound TCP port 80 available briefly for Let's Encrypt HTTP-01 issuance and renewal. If Apache, Nginx, Caddy, or Lighttpd is active on port 80, the installer temporarily stops it and starts it again after issuance. Other services are left alone; free port 80 manually if an unrecognized process owns it.
- The selected panel HTTPS port (default 3006) open in the server firewall/security group.
- Xray binary. The installer reuses an existing Xray binary if found; otherwise it installs a standalone binary using the official XTLS installer with service management disabled.

## Install or resume

Clone this project on the Ubuntu/Debian target server and run:

```bash
git clone https://github.com/SocalledTaha/connecso-vless-audit.git vless-audit
cd vless-audit
sudo bash install.sh
```

The installer asks for the panel hostname, HTTPS port, optional certificate contact email, and admin password. It obtains a Let's Encrypt certificate, installs renewal hooks, creates an unprivileged service account and systemd unit, and prints the final URL and login. If interrupted, rerun the same script from the same cloned directory. It resumes from the saved stage in `/var/lib/vless-audit/install-state.env` and preserves the configured password and saved audit results.

To update an installation, pull the new project version in the cloned directory and rerun `sudo bash install.sh` there. The saved admin password and audit results are preserved.

The installer will not continue with certificate issuance unless at least one DNS A record matches that server's public IPv4. Multiple A records are allowed, but an extra proxy/CDN address is not treated as proof that the origin is reachable. The registrar or DNS provider must not proxy/redirect the hostname during HTTP-01 issuance.

If an installation stops at a stage, run `git pull` in the cloned directory and rerun `sudo bash install.sh`. Completed stages are saved, so it resumes without repeating successful setup steps.

## Service operations

```bash
systemctl status vless-audit
systemctl restart vless-audit
journalctl -u vless-audit -n 100 --no-pager
```

Configuration and TLS copies: `/etc/vless-audit/`

Saved audits: `/var/lib/vless-audit/results/`

Install progress: `/var/lib/vless-audit/install-state.env`

Let's Encrypt renewals update the panel's certificate copies and restart only `vless-audit.service`. The temporary HTTP services stopped for renewal are restored by Certbot's post-hook.

## Uninstall

Run `sudo bash uninstall.sh`. By default, it removes the application and service but keeps `/var/lib/vless-audit` results. Pass `--purge-data` only when you also want the saved results and installer state deleted. It does not remove the TLS certificate, Xray, other panels, or web services.

## Security and resource behavior

- Subscription URLs must use HTTPS and resolve to public IP addresses; local/private targets are rejected.
- The service runs as an unprivileged `vless-audit` account with systemd filesystem protections.
- Only one audit job runs at a time. Each 10/20-route batch uses one temporary Xray process, then cleans it up.
- Download checks are explicit per route and do not run during the initial scan.
- Audit history may contain subscription URLs and config data. Restrict server access and back it up only where appropriate.

