#!/usr/bin/env python3
"""
GelombangMaya Telemetry & Threat Simulation Generator
Author: Kolonel Yummy (The Hidden Elamar)

Used to simulate real-world attack telemetry and verify detection heuristics in GelombangMaya.

Usage:
  python3 scripts/simulate-attack.py --type ssh_bruteforce
  python3 scripts/simulate-attack.py --type sqli
  python3 scripts/simulate-attack.py --type privesc
  python3 scripts/simulate-attack.py --type shadow
  python3 scripts/simulate-attack.py --type useradd
  python3 scripts/simulate-attack.py --type ioc
  python3 scripts/simulate-attack.py --type all
"""
import argparse
import json
import random
import time
import urllib.request

RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

def send_event(server, payload):
    url = f"{server.rstrip('/')}/api/trpc/siem.ingest"
    req = urllib.request.Request(
        url,
        data=json.dumps({"json": payload}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        res = json.loads(r.read())
        return res.get("result", {}).get("data", {}).get("json", {})

def simulate_ssh_bruteforce(server, attacker_ip, count=6):
    print(f"\n{CYAN}{BOLD}[*] Simulating SSH Brute Force Attack from {attacker_ip}...{RESET}")
    users = ["root", "admin", "ubuntu", "deploy", "postgres", "guest"]
    
    for i in range(count):
        user = users[i % len(users)]
        msg = f"Failed password for invalid user {user} from {attacker_ip} port {random.randint(40000, 60000)} ssh2"
        payload = {
            "agentName": "prod-auth-node-01",
            "source": "sshd",
            "level": "warning",
            "message": msg,
            "srcIp": attacker_ip,
            "user": user,
            "action": "auth_failure",
            "eventAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        
        try:
            res = send_event(server, payload)
            alerts = res.get("alertsRaised", 0)
            if alerts > 0:
                print(f"  {RED}{BOLD}⚡ Attempt #{i+1}: {msg}{RESET}")
                print(f"     {RED}🚨 [GM-0001 TRIGGERED!] SSH Brute Force Threshold Reached ({alerts} alert raised!){RESET}")
            else:
                print(f"  {YELLOW}Attempt #{i+1}: {msg} (Event #{res.get('eventId')}){RESET}")
        except Exception as e:
            print(f"  {RED}[!] Failed to send: {e}{RESET}")
        time.sleep(0.3)

def simulate_sqli(server, attacker_ip):
    print(f"\n{CYAN}{BOLD}[*] Simulating Web Attack (SQL Injection & XSS)...{RESET}")
    payloads = [
        ("GET /api/users?id=1%20OR%201=1-- HTTP/1.1", "1 OR 1=1 SQLi query"),
        ("GET /search?q=UNION%20SELECT%20null,username,password%20FROM%20users HTTP/1.1", "UNION SELECT dump"),
        ("GET /profile?name=<script>alert('pwned')</script> HTTP/1.1", "XSS payload"),
        ("GET /download?file=../../../../etc/passwd HTTP/1.1", "Path Traversal"),
    ]
    for req_line, desc in payloads:
        payload = {
            "agentName": "prod-web-gateway",
            "source": "nginx",
            "level": "error",
            "message": f"nginx access log: {attacker_ip} - [{time.strftime('%d/%b/%Y:%H:%M:%S +0000')}] \"{req_line}\" 403 542",
            "srcIp": attacker_ip,
            "action": "web_attack",
            "metadata": {"probe": desc, "http_status": 403},
        }
        res = send_event(server, payload)
        alerts = res.get("alertsRaised", 0)
        print(f"  {RED if alerts else YELLOW}Payload: {req_line}{RESET}")
        if alerts > 0:
            print(f"     {RED}🚨 [GM-0003 TRIGGERED!] Web Attack Signature Detected ({alerts} alert raised!){RESET}")
        time.sleep(0.3)

def simulate_privesc(server, attacker_ip):
    print(f"\n{CYAN}{BOLD}[*] Simulating Privilege Escalation (sudo su root)...{RESET}")
    payload = {
        "agentName": "prod-app-worker",
        "source": "sudo",
        "level": "notice",
        "message": f"sudo: attacker_user : TTY=pts/2 ; PWD=/home/attacker_user ; USER=root ; COMMAND=/bin/bash",
        "srcIp": attacker_ip,
        "user": "attacker_user",
        "action": "privilege_escalation",
    }
    res = send_event(server, payload)
    alerts = res.get("alertsRaised", 0)
    print(f"  {RED if alerts else YELLOW}Log: {payload['message']}{RESET}")
    if alerts > 0:
        print(f"     {RED}🚨 [GM-0002 TRIGGERED!] Privilege Escalation Heuristic Hit!{RESET}")

def simulate_shadow_access(server, attacker_ip):
    print(f"\n{CYAN}{BOLD}[*] Simulating Sensitive File Access (/etc/shadow)...{RESET}")
    payload = {
        "agentName": "prod-app-worker",
        "source": "auditd",
        "level": "critical",
        "message": f"type=SYSCALL arch=c000003e syscall=257 success=yes exe=\"/usr/bin/cat\" name=\"/etc/shadow\"",
        "srcIp": attacker_ip,
        "action": "file_access",
    }
    res = send_event(server, payload)
    alerts = res.get("alertsRaised", 0)
    print(f"  {RED if alerts else YELLOW}Log: {payload['message']}{RESET}")
    if alerts > 0:
        print(f"     {RED}🚨 [GM-0006 TRIGGERED!] Sensitive File Access Detected!{RESET}")

def simulate_useradd(server, attacker_ip):
    print(f"\n{CYAN}{BOLD}[*] Simulating Backdoor Local Account Creation (useradd)...{RESET}")
    payload = {
        "agentName": "prod-auth-node-01",
        "source": "useradd",
        "level": "warning",
        "message": f"useradd[1337]: new user: name=hidden_backdoor, UID=1005, GID=1005, home=/home/hidden_backdoor, shell=/bin/bash",
        "srcIp": attacker_ip,
        "action": "account_created",
    }
    res = send_event(server, payload)
    alerts = res.get("alertsRaised", 0)
    print(f"  {RED if alerts else YELLOW}Log: {payload['message']}{RESET}")
    if alerts > 0:
        print(f"     {RED}🚨 [GM-0007 TRIGGERED!] New Local Account Created Detected!{RESET}")

def main():
    parser = argparse.ArgumentParser(description="GelombangMaya Attack Telemetry Simulator")
    parser.add_argument("--server", default="http://localhost:3000", help="GelombangMaya Server URL (default: http://localhost:3000)")
    parser.add_argument(
        "--type",
        choices=["ssh_bruteforce", "sqli", "privesc", "shadow", "useradd", "all"],
        default="ssh_bruteforce",
        help="Type of attack telemetry to simulate",
    )
    parser.add_argument("--ip", default=f"185.220.{random.randint(100, 250)}.{random.randint(10, 200)}", help="Attacker IP address")
    args = parser.parse_args()

    print(f"{BOLD}{GREEN}==============================================================={RESET}")
    print(f"{BOLD}{GREEN}  🌊 GelombangMaya Autonomous Telemetry Simulator  {RESET}")
    print(f"{BOLD}{GREEN}==============================================================={RESET}")
    print(f"Target SIEM: {args.server}")
    print(f"Attacker IP: {args.ip}")
    print(f"Attack Type: {args.type}")

    if args.type == "ssh_bruteforce":
        simulate_ssh_bruteforce(args.server, args.ip, count=6)
    elif args.type == "sqli":
        simulate_sqli(args.server, args.ip)
    elif args.type == "privesc":
        simulate_privesc(args.server, args.ip)
    elif args.type == "shadow":
        simulate_shadow_access(args.server, args.ip)
    elif args.type == "useradd":
        simulate_useradd(args.server, args.ip)
    elif args.type == "all":
        simulate_ssh_bruteforce(args.server, args.ip, count=6)
        simulate_sqli(args.server, args.ip)
        simulate_privesc(args.server, args.ip)
        simulate_shadow_access(args.server, args.ip)
        simulate_useradd(args.server, args.ip)

    print(f"\n{GREEN}{BOLD}[✔] Simulation complete! Check your GelombangMaya Dashboard at {args.server}!{RESET}\n")

if __name__ == "__main__":
    main()
