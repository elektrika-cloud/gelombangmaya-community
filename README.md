# GelombangMaya (Community Edition)
### Autonomous Threat Telemetry & SecOps Defense Platform

[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-rose.svg)](LICENSE)
[![Source: Available](https://img.shields.io/badge/Source-Available-blueviolet.svg)](COMMERCIAL-TERMS.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![tRPC](https://img.shields.io/badge/tRPC-v11-indigo.svg)](https://trpc.io/)
[![Hono](https://img.shields.io/badge/Hono-v4-orange.svg)](https://hono.dev/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle%20ORM-0.45-yellow.svg)](https://orm.drizzle.team/)
[![Vitest](https://img.shields.io/badge/Tests-Passing-brightgreen.svg)](https://vitest.dev/)

A lightweight, high-performance source-available Security Information and Event Management (SIEM) and threat telemetry platform engineered by **Elektrika Cloud** and maintained by **[@hidup0bersahaja](https://github.com/hidup0bersahaja)**.

[Key Features](#key-features) | [Architecture](ARCHITECTURE.md) | [Quickstart](#quickstart-guide) | [Log Forwarder](#endpoint-agent-gm-forwarderpy) | [Detection Rules](#detection-heuristics-ruleset) | [License & Terms](COMMERCIAL-TERMS.md)

---

## Overview

GelombangMaya Community Edition (CE) is built for security engineers, penetration testing practitioners, homelab environments, and DevOps teams that require immediate, actionable threat detection and telemetry analysis without the heavy resource overhead of traditional enterprise SIEM systems.

It provides real-time event ingestion, heuristic rule evaluation, velocity-based behavioral thresholds, threat intelligence IOC correlation, and containment generation out of the box.

---

## Demo

<!-- You can insert a video demo here. GitHub supports embedding MP4 videos directly by uploading in issue/PR or referencing an animated GIF/WebP asset. -->

*Live Dashboard & Telemetry Streaming Demo:*

*(Upload your demo video / animated GIF here)*

---

## Key Features

* **Command Center & Live Telemetry HUD**: Monitor 24-hour ingestion volume, active attacker IP addresses, top log sources, and endpoint status in real time.
* **Autonomous Detection Heuristics Engine**:
  * **Pattern Matching**: Detect SQLi, XSS, Path Traversal, sensitive file access (`/etc/shadow`, `/etc/passwd`), and `sudo` privilege escalation via regular expressions.
  * **Behavioral Thresholds**: Detect SSH brute force attacks and credential password spraying using sliding time windows.
  * **Threat Intel IOC Correlation**: Cross-reference incoming logs against active IP, domain, hash, and URL threat lists.
* **Incident Triage Queue**: Structured incident lifecycle management (`Open` -> `Acknowledged` -> `Resolved` -> `False Positive`) with exportable reports.
* **1-Click Firewall Containment Assistant**: Instantly generate host-isolation commands for `iptables`, `ufw`, `nftables`, and `AWS Network ACLs`.
* **Telemetry Data Purge & Reset**: Built-in 1-click reset interface to purge events, alerts, and rule hit counters after simulation drills.
* **Zero-Dependency Python Shipper (`gm-forwarder.py`)**: Shipped using only Python 3 standard library (`urllib`, `re`, `socket`, `subprocess`) — no external packages required.
* **Endpoint Fleet Monitor**: Live tracking of forwarder agents, heartbeat monitoring, and automated stale detection.

---

## Architecture

```mermaid
flowchart TD
    subgraph Endpoints ["Monitored Endpoints & Nodes"]
        A1["Linux Server / Node\n(syslog, auth.log, journald)"] -->|gm-forwarder.py| INGEST["tRPC Ingestion Engine\n(/api/trpc/siem.ingest)"]
        A2["Web Server\n(Nginx / Apache logs)"] -->|gm-forwarder.py| INGEST
    end

    subgraph CoreEngine ["GelombangMaya Core Engine"]
        INGEST --> PIPE["Detection Pipeline\n(evaluateEvent)"]
        PIPE --> R1["Pattern Matcher\n(Regex Heuristics)"]
        PIPE --> R2["Velocity Thresholds\n(Time-Window Sliding)"]
        PIPE --> R3["IOC Correlation\n(Threat Blacklist)"]
        
        PIPE --> DB[("MySQL / MariaDB\n(Drizzle ORM)")]
    end

    subgraph SOCDashboard ["SecOps Command Center (React 19)"]
        DB --> UI1["Live Telemetry Stream"]
        DB --> UI2["Incident Triage & Containment"]
        DB --> UI3["Detection Rules Manager"]
        DB --> UI4["Threat Intel IOC Manager"]
    end
```

---

## Quickstart Guide

### Option 1: Docker Compose (Recommended)

Run GelombangMaya and MariaDB with a single command:

```bash
git clone https://github.com/elektrika-cloud/gelombangmaya-community.git
cd gelombangmaya-community
docker compose up -d
```

Access the dashboard at `http://localhost:3000`. The default database schema and detection rules (`GM-0001` - `GM-0008`) seed automatically on initial launch.

---

### Option 2: Local Development Setup

#### Prerequisites
* Node.js v20+
* MySQL 8.0+ or MariaDB 10.5+

#### Step-by-Step

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/elektrika-cloud/gelombangmaya-community.git
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
   DATABASE_URL="mysql://gelombangmaya:secretpassword@127.0.0.1:3306/gelombang_maya"
   ```

4. **Initialize Database (MariaDB/MySQL)**:
   ```bash
   sudo mysql -e "CREATE DATABASE IF NOT EXISTS gelombang_maya; CREATE USER IF NOT EXISTS 'gelombangmaya'@'localhost' IDENTIFIED BY 'secretpassword'; CREATE USER IF NOT EXISTS 'gelombangmaya'@'127.0.0.1' IDENTIFIED BY 'secretpassword'; GRANT ALL PRIVILEGES ON gelombang_maya.* TO 'gelombangmaya'@'localhost'; GRANT ALL PRIVILEGES ON gelombang_maya.* TO 'gelombangmaya'@'127.0.0.1'; FLUSH PRIVILEGES;"
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

6. **Build for Production**:
   ```bash
   npm run build
   npm start
   ```

---

## Endpoint Agent (`gm-forwarder.py`)

GelombangMaya includes a lightweight log forwarder agent in `scripts/gm-forwarder.py`. It runs on any Linux distribution with Python 3 standard library only.

### Quick Run:
```bash
sudo python3 scripts/gm-forwarder.py --server http://localhost:3000
```

### Production Systemd Service (`/etc/systemd/system/gm-forwarder.service`):
```bash
sudo python3 scripts/gm-forwarder.py --server http://localhost:3000 --install-service
```

Manual systemd configuration:
```ini
[Unit]
Description=GelombangMaya Endpoint Log Forwarder Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/gelombangmaya
ExecStart=/usr/bin/python3 /opt/gelombangmaya/scripts/gm-forwarder.py --server http://your-siem-ip:3000 --name prod-node-01
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gm-forwarder
```

---

## Detection Heuristics Ruleset

| Rule ID | Title | Mechanism | Default Action |
| :--- | :--- | :--- | :--- |
| `GM-0001` | SSH Brute Force | Threshold | 5+ auth failures from 1 IP in 5 minutes |
| `GM-0002` | Privilege Escalation | Pattern Match | Detects sudo su root or root shell execution |
| `GM-0003` | Web Attack Signature | Pattern Match | Detects SQLi, XSS, and Path Traversal patterns |
| `GM-0004` | Known Malicious IOC | Threat Intel | Correlates against active IOC database |
| `GM-0005` | Account Password Spray | Threshold | 10+ auth failures on 1 user in 10 minutes |
| `GM-0006` | Sensitive File Access | Pattern Match | Detects access to /etc/shadow, /etc/passwd, .pem |
| `GM-0007` | New Account Created | Pattern Match | Detects useradd, adduser, net user /add |
| `GM-0008` | Critical Service Error | Pattern Match | Detects panic, fatal, segfault, out of memory |

---

## Testing and Verification

Run the test suite:

```bash
# Type check
npm run check

# Linter
npm run lint

# Unit test suite
npm run test
```

---

## Contributing

Contributions, issue reports, and rule improvements are welcome. Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

---

## License & Commercial Terms

This software is licensed under the **[PolyForm Noncommercial License 1.0.0](LICENSE)** (Source-Available, Free for Noncommercial Use).

* **Permitted Use**: You may freely inspect, study, fork, modify, deploy, and run this project for personal homelabs, educational coursework, academic research, and non-commercial security testing purposes.
* **Commercial Use**: Using this software for revenue-generating commercial operations, enterprise production environments, managed SOC services, or paid appliances is strictly prohibited under this license.
* **Commercial Licensing & Enterprise Rights**: For commercial licensing, enterprise multi-tenancy, custom threat rule development, and SLA support, please consult **[COMMERCIAL-TERMS.md](COMMERCIAL-TERMS.md)** or contact `jebatzh@gmail.com`.

---

## 🏷️ Trademark Policy

**GelombangMaya™** is a trademark of **Elektrika Cloud**. All rights reserved.

---

Maintained by **[@hidup0bersahaja](https://github.com/hidup0bersahaja)** & **[Elektrika Cloud](https://github.com/elektrika-cloud)**.

