<div align="center">

# 🌊 GelombangMaya (Community Edition)
### Autonomous Threat Telemetry & SecOps Defense Platform

[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-rose.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![tRPC](https://img.shields.io/badge/tRPC-v11-indigo.svg)](https://trpc.io/)
[![Hono](https://img.shields.io/badge/Hono-v4-orange.svg)](https://hono.dev/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle%20ORM-0.45-yellow.svg)](https://orm.drizzle.team/)
[![Vitest](https://img.shields.io/badge/Tests-Passing-brightgreen.svg)](https://vitest.dev/)

**A lightweight, high-performance Security Information & Event Management (SIEM) and Threat Telemetry platform created by Genuine-FancyBear.**

[Key Features](#-key-features) •
[Architecture](#-architecture) •
[Quickstart](#-quickstart-guide) •
[Log Forwarder](#-endpoint-agent-gm-forwarderpy) •
[Detection Rules](#-detection-heuristics-ruleset) •
[License & Terms](#-license--commercial-terms)

</div>

---

## 🌟 Overview

**GelombangMaya Community Edition (CE)** is built for security engineers, pentesting practitioners, homelab enthusiasts, and devops teams who need immediate, actionable threat detection and telemetry analysis without the heavy resource footprint of legacy SIEM suites.

It delivers real-time event streaming, heuristic rule evaluation, behavioral velocity thresholds, threat intelligence correlation, and one-click incident containment commands out of the box.

---

## ⚡ Key Features

* **Command Center & Live Telemetry HUD**: Monitor 24-hour ingestion volumes, active attacker IPs, top log sources, and system telemetry in real time.
* **Autonomous Detection Heuristics Engine**:
  * **Pattern Matching**: Catch SQLi, XSS, Path Traversal, `/etc/shadow` reads, and `sudo` privilege escalations using regex.
  * **Behavioral Thresholds**: Detect SSH brute-forcing and credential password sprays based on sliding time windows.
  * **Threat Intel IOC Correlation**: Cross-reference incoming logs against active IP, domain, hash, and URL blacklists.
* **Incident Triage Queue**: Seamless workflow (`Open` ➔ `Acknowledged` ➔ `Resolved` ➔ `False Positive`) with CSV reporting.
* **1-Click Firewall Containment Assistant**: Instantly generate host-isolation syntax for `iptables`, `UFW`, `nftables`, and `AWS Network ACLs`.
* **Zero-Dependency Python Shipper (`gm-forwarder.py`)**: Shipped using only Python 3 standard library (`urllib`, `re`, `socket`) — no `pip install` required!
* **Endpoint Fleet Monitor**: Live tracking of forwarder agents, heartbeat monitoring, and automated stale detection.

---

## 🏗️ Architecture

```mermaid
flowchart TD
    subgraph Endpoints ["🖥️ Monitored Endpoints & Nodes"]
        A1["Linux Server / Node\n(syslog, auth.log)"] -->|gm-forwarder.py| INGEST["tRPC Ingestion Engine\n(/api/trpc/siem.ingest)"]
        A2["Web Server\n(Nginx / Apache logs)"] -->|gm-forwarder.py| INGEST
    end

    subgraph CoreEngine ["⚡ GelombangMaya Core Engine"]
        INGEST --> PIPE["Detection Pipeline\n(evaluateEvent)"]
        PIPE --> R1["Pattern Matcher\n(Regex Heuristics)"]
        PIPE --> R2["Velocity Thresholds\n(Time-Window Sliding)"]
        PIPE --> R3["IOC Correlation\n(Threat Blacklist)"]
        
        PIPE --> DB[("MySQL / MariaDB\n(Drizzle ORM)")]
    end

    subgraph SOCDashboard ["🛡️ SecOps Command Center (React 19)"]
        DB --> UI1["Live Telemetry Stream"]
        DB --> UI2["Incident Triage & Containment"]
        DB --> UI3["Detection Rules Manager"]
        DB --> UI4["Threat Intel IOC Manager"]
    end
```

---

## 🚀 Quickstart Guide

### Option 1: Docker Compose (Recommended)

Run GelombangMaya and MySQL with a single command:

```bash
git clone https://github.com/Genuine-FancyBear/gelombangmaya-community.git
cd gelombangmaya-community
docker compose up -d
```

Open your browser at **`http://localhost:3000`**. The default database schema and detection rules (`GM-0001` - `GM-0008`) will seed automatically on first boot!

---

### Option 2: Local Development Setup

#### Prerequisites
* Node.js v20+
* MySQL 8.0+ or MariaDB 10.5+

#### Step-by-Step

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Genuine-FancyBear/gelombangmaya-community.git
   cd gelombangmaya-community
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```
   Update `.env` with your database credentials:
   ```env
   PORT=3000
   DATABASE_URL="mysql://gelombangmaya:secretpassword@localhost:3306/gelombangmaya_db"
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

5. **Build for Production**:
   ```bash
   npm run build
   npm start
   ```

---

## 📡 Endpoint Agent (`gm-forwarder.py`)

GelombangMaya includes a lightweight log forwarder agent in `scripts/gm-forwarder.py`. It runs on any Linux distribution with **Python 3 standard library only**.

### Quick Run:
```bash
python3 scripts/gm-forwarder.py \
    --server http://localhost:3000 \
    --name prod-web-01 \
    --file /var/log/auth.log \
    --source sshd
```

### Production Systemd Service (`/etc/systemd/system/gm-forwarder.service`):
```ini
[Unit]
Description=GelombangMaya Endpoint Log Forwarder Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/gelombangmaya
ExecStart=/usr/bin/python3 /opt/gelombangmaya/scripts/gm-forwarder.py --server http://your-siem-ip:3000 --name prod-web-01 --file /var/log/auth.log --source sshd
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gm-forwarder
```

---

## 🛡️ Detection Heuristics Ruleset

| Rule ID | Title | Mechanism | Default Action |
| :--- | :--- | :--- | :--- |
| **`GM-0001`** | **SSH Brute Force** | Threshold | 5+ auth failures from 1 IP in 5 mins |
| **`GM-0002`** | **Privilege Escalation** | Pattern Match | Detects `sudo su root` or root shell execution |
| **`GM-0003`** | **Web Attack Signature** | Pattern Match | Detects SQLi (`OR 1=1`), XSS, and Path Traversal |
| **`GM-0004`** | **Known Malicious IOC** | Threat Intel | Correlates against active IOC repository |
| **`GM-0005`** | **Account Password Spray**| Threshold | 10+ auth failures on 1 user in 10 mins |
| **`GM-0006`** | **Sensitive File Access** | Pattern Match | Detects access to `/etc/shadow`, `/etc/passwd`, `.pem` |
| **`GM-0007`** | **New Account Created**   | Pattern Match | Detects `useradd`, `adduser`, `net user /add` |
| **`GM-0008`** | **Critical Service Error**| Pattern Match | Detects `panic`, `fatal`, `segfault`, `out of memory` |

---

## 🧪 Testing & Verification

Run the built-in test suite:

```bash
# Type check
npm run check

# Linter
npm run lint

# Vitest unit test suite
npm run test
```

---

## 🤝 Contributing

Contributions, bug reports, and rule improvements are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on submitting pull requests.

---

## 📄 License & Commercial Terms

This software is licensed under the **[PolyForm Noncommercial License 1.0.0](LICENSE)**.

* **You CAN**: Freely view, study, fork, modify, and run this project for personal, educational, research, and non-commercial security testing purposes.
* **You CANNOT**: Sell, resell, rent, lease, sublicense, or monetize this software, its derivative works, or provide it as a paid commercial managed service.
* **Commercial Inquiries**: For commercial licensing, enterprise deployment rights, or custom partnerships, contact **Genuine-FancyBear**.

---

<div align="center">
  <sub>Authored by <strong>Genuine-FancyBear (little brother)</strong></sub>
</div>
