# 🧭 Connecso Outbound Audit

[فارسی](README.fa.md) · **English**

A self-hosted web panel for checking subscription routes and exporting working proxy outbounds as a direct JSON array.

## 📚 Contents
- [✨ Features](#-features)
- [🧪 How checks work](#-how-checks-work)
- [🧰 Requirements](#-requirements)
- [🚀 Install or resume](#-install-or-resume)
- [⚙️ Manage the panel](#-manage-the-panel)
- [🔐 Data and security](#-data-and-security)
- [🗑️ Uninstall](#-uninstall)

## ✨ Features
- Import a subscription URL or paste plain/Base64 configuration text.
- Test VLESS, Shadowsocks, and Hysteria2 through Xray; identify VLESS transports including TCP, WS, gRPC, HTTPUpgrade, and XHTTP.
- Review HTTPS RTT, exit IP and country, and reachability checks for Gemini, YouTube, Instagram, and Telegram.
- Scan batches of 10 or 20 using one temporary Xray process per batch with bounded route concurrency.
- Filter by country/protocol/service, search, sort, find duplicates, and copy or download country-grouped JSON.
- Reopen or rescan saved audits, recheck one route or all routes in a country, and run an optional five-second download check.
- Persian/English UI, light/dark themes, and protected administrator login.

This tool only audits and exports configurations. It does not modify another panel, existing Xray services, clients, or routing rules.

## 🧪 How checks work
Each scan batch starts one temporary Xray process with a separate local SOCKS port per route. A bounded worker pool limits active requests to reduce contention. Displayed RTT is HTTPS response time through that route, not ICMP. The separate server-to-destination figure is TCP/TLS connection time measured from the audit server through the route. Service checks measure HTTPS reachability, not account login.

## 🧰 Requirements
- Ubuntu or Debian with root access.
- A DNS A record pointing directly to the server's public IPv4 during certificate issuance.
- Port 80 available briefly for Let's Encrypt HTTP-01.
- The selected HTTPS panel port open in the firewall/security group.
- Xray. The installer reuses a local binary when available; otherwise it installs a standalone copy without managing existing Xray services.

## 🚀 Install or resume
Run as root:

    bash <(curl -fsSL https://raw.githubusercontent.com/SocalledTaha/connecso-vless-audit/main/quick-install.sh)

The installer asks for the hostname, HTTPS port, optional certificate email, and admin password. It installs the service and certificate and prints the URL and login. Rerun the same command after an interruption to resume the saved stage.

## ⚙️ Manage the panel
After installation, type ConnecsoTools (case-insensitive) to open maintenance, or rerun sudo bash install.sh. The menu can renew or reissue TLS, change the domain or port, diagnose the service, update from GitHub, restart the panel, and change the admin password.

Updates pull the main branch and reapply app files. Saved results and the admin password remain in the data directory.

## 🔐 Data and security
- Subscription URLs must use HTTPS and resolve to public IPs; local/private destinations are rejected.
- Results and subscription details are stored locally under /var/lib/vless-audit/results/. Protect server access and backups.
- The service runs as an unprivileged account with systemd filesystem protections.
- Download checks run only on request and use four parallel streams for five seconds.
- systemd-journald manages logs; maintenance displays the latest 40 entries.

## 🗑️ Uninstall
Run:

    sudo bash uninstall.sh

Saved audit data is kept by default. Use --purge-data only to also remove results and installer state. The uninstaller leaves Xray, other panels, and web servers alone.
