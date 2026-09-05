# System Architecture & Technical Design

### GelombangMaya Community Edition (CE)

---

## 🏗️ High-Level Architectural Overview

GelombangMaya is engineered as a lightweight, end-to-end Threat Telemetry & SecOps platform. It integrates real-time log forwarding, event ingestion, heuristic evaluation, threshold-based correlation, and active containment generation.

```mermaid
flowchart TD
    subgraph MonitoredEndpoints ["Monitored Endpoints (Linux / Windows / Docker)"]
        F1["gm-forwarder.py\n(Syslog / Journald / Auth.log / Nginx)"]
        F2["gm-forwarder.ps1\n(Windows Security Event Logs)"]
    end

    subgraph Transport ["Encrypted Telemetry Layer"]
        NET["HTTP/JSON or Syslog UDP:5140"]
    end

    subgraph IngestionLayer ["GelombangMaya Server Engine"]
        BOOT["Hono Server Gateway\n(api/boot.ts)"]
        TRPC["tRPC API Router\n(api/routers/siem.ts)"]
        RULES["Heuristic Detection Engine\n(api/detection.ts)"]
    end

    subgraph StorageLayer ["Relational & State Persistence"]
        DB[(MariaDB / MySQL 8.0+)\nDrizzle ORM (schema.ts)]
    end

    subgraph FrontendHUD ["Interactive SecOps Dashboard"]
        VITE["Vite + React 19 + Tailwind CSS"]
        SOC["Command Center • Alerts Triage • Fleet Monitor • IOC Intel"]
    end

    F1 -->|JSON Payload| NET
    F2 -->|JSON Payload| NET
    NET --> BOOT
    BOOT --> TRPC
    TRPC --> RULES
    RULES -->|Store Events & Alerts| DB
    SOC -->|tRPC Queries & Subscriptions| TRPC
```

---

## 🧩 Core Technical Components

### 1. Unified Gateway (`api/boot.ts` & `api/server.ts`)
* Built on **Hono v4** running on Node.js 20+.
* Serves static compiled Vite frontend assets, JSON-based tRPC endpoints, and dynamic installer script generators (`/api/agent/install.sh`, `/api/agent/install.ps1`).
* Mounts health probes, rate limiting, and CORS handlers.

### 2. Type-Safe Ingestion & RPC (`api/routers/siem.ts` & `contracts/`)
* Employs **tRPC v11** with **Zod** schema validation.
* Guarantees end-to-end TypeScript type safety between backend mutation endpoints and frontend React hooks without code generation steps.

### 3. Threat Detection & Correlation Engine (`api/detection.ts`)
* Evaluates logs against MITRE ATT&CK-aligned heuristics:
  * **Regex Pattern Matching:** Detects web attack signatures (SQLi, XSS, Path Traversal), sensitive file access (`/etc/shadow`), and unauthorized `sudo` executions.
  * **Sliding-Window Behavioral Thresholds:** Aggregates velocity metrics (e.g., $\ge 5$ failed authentications within 60 seconds) to detect brute-force and credential spraying.
  * **Threat Intelligence Cross-Correlation:** Validates source IPs against active IOC reputation databases.

### 4. Persistence Layer (`db/schema.ts`)
* Uses **Drizzle ORM** for zero-overhead SQL querying over MariaDB or MySQL.
* Tables:
  * `events`: High-velocity raw log store with indexed timestamps and source IP filters.
  * `alerts`: Deduped security incidents with severity tagging (`low`, `medium`, `high`, `critical`) and triage lifecycle states (`open`, `acknowledged`, `resolved`, `false_positive`).
  * `agents`: Fleet registry tracking forwarder hostnames, IP addresses, OS types, and keepalive heartbeats.
  * `threat_iocs`: Active indicators of compromise for automated cross-referencing.
  * `rules`: Dynamic heuristic rules with toggleable states and severity levels.

### 5. Frontend SecOps Dashboard (`src/`)
* Powered by **Vite 7** and **React 19** with custom tactical Tailwind CSS styling.
* Real-time metrics polling, interactive tabbed navigation, 1-click firewall rule generators (`iptables`, `ufw`, `nftables`, `AWS NACL`), and dark/light mode rendering.

---

## 🔒 Security & Privacy Architecture

* **Zero-Dependency Forwarders:** Shipper scripts rely exclusively on built-in OS libraries (`urllib` / `.NET WebClient`) to prevent supply chain tampering.
* **Sensitive Data Redaction:** Raw passwords and sensitive tokens within incoming payloads are automatically sanitized before persistence.
* **Non-Root Execution:** Designed to run inside isolated Docker containers or low-privilege systemd units.
