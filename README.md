# 🧭 Connecso Outbound Audit

[فارسی](README.fa.md) · **English**

A self-hosted web panel for checking proxy routes from subscription links or pasted configs, reviewing saved audits, and exporting working outbounds as JSON.

## 📚 Contents
- [✨ Features](#-features)
- [🧪 How checks work](#-how-checks-work)
- [🧰 Requirements](#-requirements)
- [🚀 Install or resume](#-install-or-resume)
- [⚙️ Manage the panel](#-manage-the-panel)
- [🔐 Data and security](#-data-and-security)
- [🗑️ Uninstall](#-uninstall)

## ✨ Features
- Read an HTTPS subscription URL or paste plain-text/Base64 configs.
- Select which protocols to scan: VLESS, VMess, Trojan, Shadowsocks, and Hysteria2. Xray WireGuard and MASQUE outbounds can be supplied as Xray JSON. AmneziaWG is not a native Xray outbound and is not scanned as one.
- Show HTTPS response time (RTT), exit IP/country, and optional HTTPS reachability for Gemini, YouTube, Instagram, and Telegram.
- Run checks in batches of 10 or 20 with bounded concurrency.
- Filter by country and protocol, search, sort, identify duplicates, and copy/download country-grouped JSON.
- Reopen or rescan saved audits; give a saved audit a custom name and tags or mark it as a favorite.
- Recheck a route or all routes in a country and optionally run a five-second download check.
- Use the Persian/English interface, light/dark themes, and password-protected administrator login.

This tool checks and exports configurations. It does not change another panel, its clients, routing rules, or an existing Xray service. Temporary Xray processes are launched only while checks are running.

## 🧪 How checks work
Each batch uses a temporary Xray process and a separate local SOCKS port per route. The displayed RTT is the time for an HTTPS request to receive a response through that route; it is not ICMP ping and does not represent server-to-server latency. The optional service indicators also measure HTTPS reachability only, not account login. Download tests run only when requested.

## 🧰 Requirements
- Ubuntu or Debian and root access.
- A DNS A record that resolves directly to the server's public IPv4 while Let's Encrypt issues the certificate.
- Port 80 available briefly for the HTTP-01 certificate challenge.
- The chosen HTTPS panel port allowed by the server firewall and provider.
- Xray. The installer reuses a local binary when available, otherwise it installs a separate copy and does not manage an existing Xray service.

## 🚀 Install or resume
Run as root:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/SocalledTaha/connecso-vless-audit/main/quick-install.sh)
```

The installer asks for the panel domain, HTTPS port, optional certificate email, and administrator password. If installation is interrupted, run the same command again to resume from its saved stage.

## ⚙️ Manage the panel
After installation, enter `ConnecsoTools` (case-insensitive) to open maintenance. The menu can renew/reissue TLS, change the domain or HTTPS port, diagnose the panel and show recent logs, update from GitHub, restart the service, and change the administrator password.

## 🔐 Data and security
- Subscription URLs must use HTTPS and resolve to public addresses; local/private destinations are rejected.
- Saved audits, labels, favorite flags, tags, and installer state are kept under `/var/lib/vless-audit/`. Audit records also contain the submitted subscription URL when one was used; protect server access and backups accordingly.
- The service runs as an unprivileged account with systemd filesystem restrictions.
- The optional download check runs for five seconds using four parallel streams.
- Logs are managed by systemd-journald; the maintenance menu shows the latest 40 log entries.

## 🗑️ Uninstall
The repository is cloned to `/opt/vless-audit/project-source`. Run the uninstaller by its full path (this works from any current directory):

```bash
sudo bash /opt/vless-audit/project-source/uninstall.sh
```

This stops and disables only the `vless-audit` service, removes this application's files and settings, its maintenance command, and its certificate-renewal hooks. By default, saved audits, installer state, and the service account/group remain under `/var/lib/vless-audit/`. To delete that data and remove the service account/group too, run:

```bash
sudo bash /opt/vless-audit/project-source/uninstall.sh --purge-data
```

The uninstaller does not uninstall system packages or Xray, and leaves other panels, web servers, and the original Let's Encrypt certificates untouched. Because the project directory is removed during uninstall, download/clone the repository again before running the purge command later.
