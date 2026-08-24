#!/usr/bin/env python3
"""
GelombangMaya Production Telemetry Forwarder Agent
Author: Genuine-FancyBear

Production-grade real-time endpoint collector:
- Hooks into systemd journalctl (sshd, sudo, nginx) AND tails physical log files.
- Intercepts Hydra, Medusa, Ncrack, Nmap SSH brute-force attacks in real time.
- Zero third-party dependencies (Python 3 standard library only).
- Includes 1-command systemd daemon installation for 24/7 background operation.

Usage:
  # 1. Run live in terminal (auto-detects journalctl or log files):
  sudo python3 scripts/gm-forwarder.py --server http://localhost:3000

  # 2. Install and start as permanent 24/7 background service:
  sudo python3 scripts/gm-forwarder.py --server http://localhost:3000 --install-service
"""
import argparse
import glob
import json
import os
import re
import select
import socket
import subprocess
import sys
import time
import urllib.request

# --- Colors for CLI ---
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

# --- High-Accuracy Regex Patterns for OpenSSH, PAM, Hydra, Web ---
AUTH_FAIL_RE = re.compile(
    r"(Failed password|authentication failure|failed authentication|Invalid user|Failed publickey|"
    r"maximum authentication attempts exceeded|Connection closed by authenticating user|"
    r"Connection closed by invalid user|Disconnected from authenticating user|"
    r"Disconnected from invalid user|Received disconnect.*preauth|check pass; user unknown|"
    r"penalty:\s*failed authentication|srclimit_penalise|drop connection.*penalty)",
    re.IGNORECASE,
)
AUTH_OK_RE = re.compile(r"(Accepted password|Accepted publickey|session opened for user)", re.IGNORECASE)
SUDO_RE = re.compile(r"(sudo:\s+\S+\s+:|COMMAND=)", re.IGNORECASE)
WEB_ATTACK_RE = re.compile(r"(union\s+select|or\s+1=1|<script|\.\./\.\./|/etc/passwd|xp_cmdshell)", re.IGNORECASE)

IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
USER_RE = re.compile(r"for (?:invalid user )?([a-zA-Z0-9_\-\.\@]+) from|user[= ]([a-zA-Z0-9_\-]+)", re.IGNORECASE)

NOISY_PROCESSES = ("chromium", "chrome", "firefox", "brave", "electron", "code", "systemd-resolved", "pipewire", "pulseaudio", "dbus", "gnome", "plasmashell", "kded", "discord", "slack", "spotify")

def parse_log_line(line):
    """Parses a single raw log line into structured SIEM telemetry."""
    text = line.strip()
    if not text:
        return None

    text_lower = text.lower()

    # Exclude noisy desktop client apps
    if any(app in text_lower for app in NOISY_PROCESSES):
        return None

    # Must match security daemon or authentic attack pattern
    is_security_daemon = any(daemon in text_lower for daemon in ("sshd", "sshd-session", "sudo", "pam_", "nginx", "apache", "auditd", "useradd"))
    has_attack_pattern = bool(AUTH_FAIL_RE.search(text) or AUTH_OK_RE.search(text) or SUDO_RE.search(text) or WEB_ATTACK_RE.search(text))

    if not (is_security_daemon or has_attack_pattern):
        return None

    action, level = None, "info"
    source = "sshd"

    if "sudo" in text_lower:
        source = "sudo"
    elif "nginx" in text_lower or "apache" in text_lower or "http" in text_lower:
        source = "web"
    elif "pam" in text_lower and "ssh" not in text_lower:
        source = "pam"

    # Match actions
    if AUTH_FAIL_RE.search(text):
        action = "auth_failure"
        level = "warning"
    elif AUTH_OK_RE.search(text):
        action = "auth_success"
        level = "info"
    elif SUDO_RE.search(text):
        action = "privilege_escalation"
        level = "notice"
    elif WEB_ATTACK_RE.search(text):
        action = "web_attack"
        level = "critical"

    # Extract IPs (prefer external non-loopback IP, fallback to loopback if local)
    ips = IP_RE.findall(text)
    ext_ips = [ip for ip in ips if not ip.startswith("127.") and ip != "0.0.0.0"]
    src_ip = ext_ips[-1] if ext_ips else (ips[-1] if ips else None)

    # Extract Target Username
    user = None
    m = USER_RE.search(text)
    if m:
        user = m.group(1) or m.group(2)

    return {
        "source": source,
        "level": level,
        "message": text[:4000],
        "action": action,
        "srcIp": src_ip,
        "user": user,
    }

def send_to_siem(server, payload):
    """Dispatches event payload to GelombangMaya tRPC ingest endpoint."""
    url = f"{server.rstrip('/')}/api/trpc/siem.ingest"
    req = urllib.request.Request(
        url,
        data=json.dumps({"json": payload}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            res = json.loads(r.read())
            return res.get("result", {}).get("data", {}).get("json", {})
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8")
        except Exception:
            pass
        raise Exception(f"HTTP {e.code}: {e.reason} ({body[:120]})") from None

def install_systemd_service(server, name):
    """Installs gm-forwarder as a systemd service for 24/7 background operation."""
    script_path = os.path.abspath(__file__)
    python_bin = sys.executable
    service_content = f"""[Unit]
Description=GelombangMaya Production Endpoint Telemetry Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={os.path.dirname(script_path)}
ExecStart={python_bin} {script_path} --server {server} --name {name}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"""
    service_file = "/etc/systemd/system/gm-forwarder.service"
    try:
        with open(service_file, "w") as f:
            f.write(service_content)
        subprocess.run(["systemctl", "daemon-reload"], check=True)
        subprocess.run(["systemctl", "enable", "--now", "gm-forwarder"], check=True)
        print(f"{GREEN}{BOLD}[✔] Service installed & started successfully!{RESET}")
        print(f"    Check status: {CYAN}sudo systemctl status gm-forwarder{RESET}")
        print(f"    View live logs: {CYAN}sudo journalctl -u gm-forwarder -f{RESET}")
    except Exception as e:
        print(f"{RED}[!] Failed to install systemd service: {e}{RESET}")
        print("    Ensure you run this command with 'sudo'.")

def run_journalctl_stream(server, agent_name, agent_meta):
    """Streams live log events directly from systemd-journald."""
    cmd = ["journalctl", "-f", "-n", "0"]
    print(f"{CYAN}[*] Streaming live telemetry from systemd-journald (OpenSSH, Sudo, PAM)...{RESET}")

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)

    for raw_line in iter(proc.stdout.readline, ""):
        parsed = parse_log_line(raw_line)
        if not parsed:
            continue
        dispatch(server, agent_name, agent_meta, parsed)

def run_file_tail_stream(server, agent_name, agent_meta, file_paths):
    """Tails one or multiple log files simultaneously."""
    print(f"{CYAN}[*] Tailing active log files: {', '.join(file_paths)}{RESET}")
    
    open_files = {}
    for p in file_paths:
        try:
            f = open(p, "r")
            f.seek(0, 2) # Seek to end of file
            open_files[p] = f
            print(f"    {GREEN}✔ Attached to {p}{RESET}")
        except Exception as e:
            print(f"    {YELLOW}⚠ Could not open {p} ({e}){RESET}")

    if not open_files:
        print(f"{RED}[!] No log files could be opened. Try running with 'sudo'.{RESET}")
        return

    while True:
        has_read = False
        for path, f in list(open_files.items()):
            line = f.readline()
            if line:
                has_read = True
                parsed = parse_log_line(line)
                if parsed:
                    dispatch(server, agent_name, agent_meta, parsed)
            else:
                # Check for log rotation (inode change)
                try:
                    if os.path.exists(path) and os.stat(path).st_ino != os.fstat(f.fileno()).st_ino:
                        f.close()
                        open_files[path] = open(path, "r")
                except Exception:
                    pass
        if not has_read:
            time.sleep(0.2)

def dispatch(server, agent_name, agent_meta, parsed):
    """Packages and sends parsed telemetry to GelombangMaya."""
    payload = {
        "agentName": agent_name,
        "source": parsed.get("source") or "sshd",
        "level": parsed.get("level") or "info",
        "message": parsed.get("message") or "telemetry event",
    }
    if agent_meta:
        payload["agent"] = {
            "hostname": agent_meta.get("hostname"),
            "os": agent_meta.get("os"),
            "version": agent_meta.get("python"),
        }
    if parsed.get("action"):
        payload["action"] = parsed["action"]
    if parsed.get("srcIp"):
        payload["srcIp"] = parsed["srcIp"]
    if parsed.get("user"):
        payload["user"] = parsed["user"]

    try:
        res = send_to_siem(server, payload)
        alerts = res.get("alertsRaised", 0)

        # Colorized HUD output
        if alerts > 0:
            print(f"{RED}{BOLD}[🚨 ALERT TRIGGERED (x{alerts})] {parsed['source']} | IP: {parsed.get('srcIp') or 'N/A'} | User: {parsed.get('user') or 'N/A'}{RESET}")
            print(f"    {RED}➔ {parsed['message'][:110]}{RESET}")
        elif parsed.get("action") == "auth_failure":
            print(f"{YELLOW}[⚡ AUTH FAILURE] IP: {parsed.get('srcIp') or 'N/A'} | User: {parsed.get('user') or 'N/A'} | Event #{res.get('eventId')}{RESET}")
        else:
            print(f"[gm-forwarder] Ingested event #{res.get('eventId')} ({parsed['source']})")
    except Exception as e:
        print(f"{YELLOW}[gm-forwarder] Could not forward event: {e}{RESET}")

def main():
    parser = argparse.ArgumentParser(description="GelombangMaya Production Telemetry Agent")
    parser.add_argument("--server", default="http://localhost:3000", help="GelombangMaya Server URL (default: http://localhost:3000)")
    parser.add_argument("--name", default=socket.gethostname(), help="Agent Name Identifier")
    parser.add_argument("--file", default=None, help="Explicit file to tail (e.g. /var/log/auth.log)")
    parser.add_argument("--install-service", action="store_true", help="Install & start as 24/7 systemd background service")
    args = parser.parse_args()

    # If --install-service requested
    if args.install_service:
        install_systemd_service(args.server, args.name)
        return

    print(f"{BOLD}{GREEN}==============================================================={RESET}")
    print(f"{BOLD}{GREEN}  🌊 GelombangMaya Production Telemetry Agent                  {RESET}")
    print(f"{BOLD}{GREEN}  Real-time Hydra / OpenSSH / Sudo Attack Interceptor          {RESET}")
    print(f"{BOLD}{GREEN}==============================================================={RESET}")
    print(f"Agent Name : {BOLD}{args.name}{RESET}")
    print(f"SIEM Server: {BOLD}{args.server}{RESET}")

    agent_meta = {
        "hostname": socket.gethostname(),
        "os": f"{os.uname().sysname} {os.uname().release}",
        "python": sys.version.split()[0],
    }

    # Initial registration & handshake
    try:
        send_to_siem(args.server, {
            "agentName": args.name,
            "agent": agent_meta,
            "source": "agent",
            "level": "info",
            "message": "Production agent connected and online",
        })
        print(f"{GREEN}[✔] Handshake confirmed with GelombangMaya SIEM.{RESET}\n")
    except Exception as e:
        print(f"{YELLOW}[⚠] SIEM initial handshake failed: {e}. Will proceed and auto-retry.{RESET}\n")

    # Mode 1: Explicit file specified
    if args.file:
        run_file_tail_stream(args.server, args.name, agent_meta, [args.file])
        return

    # Mode 2: Check for existing traditional log files
    candidate_logs = [
        "/var/log/auth.log",
        "/var/log/secure",
        "/var/log/syslog",
        "/var/log/messages",
        "/var/log/audit/audit.log",
    ]
    existing_logs = [p for p in candidate_logs if os.path.exists(p)]

    if existing_logs:
        run_file_tail_stream(args.server, args.name, agent_meta, existing_logs)
    else:
        # Mode 3: Modern systemd-journald streaming
        run_journalctl_stream(args.server, args.name, agent_meta)

if __name__ == "__main__":
    main()
