import { describe, it, expect } from "vitest";
import { DEFAULT_RULES } from "./detection";

describe("GelombangMaya Detection Ruleset & Heuristics", () => {
  it("should have all default rules properly formatted with valid JSON configs", () => {
    expect(DEFAULT_RULES.length).toBeGreaterThanOrEqual(8);

    for (const rule of DEFAULT_RULES) {
      expect(rule.code).toMatch(/^GM-\d{4}$/);
      expect(rule.name).toBeTruthy();
      expect(["low", "medium", "high", "critical"]).toContain(rule.severity);
      expect(["match", "threshold", "ioc"]).toContain(rule.kind);

      const parsed = JSON.parse(rule.config);
      expect(parsed.kind).toBe(rule.kind);
    }
  });

  describe("Pattern Matching Heuristics (GM-0002, GM-0003, GM-0006, GM-0007, GM-0008)", () => {
    it("GM-0002: should detect Privilege Escalation (sudo / su to root)", () => {
      const rule = DEFAULT_RULES.find((r) => r.code === "GM-0002");
      expect(rule).toBeDefined();
      const cfg = JSON.parse(rule!.config);
      const regex = new RegExp(cfg.pattern, "i");

      expect(regex.test("sudo su - root")).toBe(true);
      expect(regex.test("sudo: pam_unix(sudo:session): COMMAND=/bin/bash")).toBe(true);
      expect(regex.test("normal user logged in")).toBe(false);
    });

    it("GM-0003: should detect Web Attack Signatures (SQLi, XSS, Path Traversal)", () => {
      const rule = DEFAULT_RULES.find((r) => r.code === "GM-0003");
      expect(rule).toBeDefined();
      const cfg = JSON.parse(rule!.config);
      const regex = new RegExp(cfg.pattern, "i");

      // SQLi
      expect(regex.test("SELECT * FROM users WHERE id=1 OR 1=1")).toBe(true);
      expect(regex.test("UNION SELECT null, username, password FROM users")).toBe(true);

      // XSS
      expect(regex.test("GET /index.php?name=<script>alert(1)</script>")).toBe(true);

      // Path Traversal
      expect(regex.test("GET /static/../../etc/passwd HTTP/1.1")).toBe(true);

      // Harmless request
      expect(regex.test("GET /dashboard/overview HTTP/1.1 200 OK")).toBe(false);
    });

    it("GM-0006: should detect Sensitive File Access (/etc/shadow, id_rsa, .pem)", () => {
      const rule = DEFAULT_RULES.find((r) => r.code === "GM-0006");
      expect(rule).toBeDefined();
      const cfg = JSON.parse(rule!.config);
      const regex = new RegExp(cfg.pattern, "i");

      expect(regex.test("cat /etc/shadow")).toBe(true);
      expect(regex.test("cat /etc/passwd")).toBe(true);
      expect(regex.test("reading private key ~/.ssh/id_rsa")).toBe(true);
      expect(regex.test("exporting certificate cert.pem")).toBe(true);
      expect(regex.test("cat /var/log/syslog")).toBe(false);
    });

    it("GM-0007: should detect New Local Account Creation", () => {
      const rule = DEFAULT_RULES.find((r) => r.code === "GM-0007");
      expect(rule).toBeDefined();
      const cfg = JSON.parse(rule!.config);
      const regex = new RegExp(cfg.pattern, "i");

      expect(regex.test("useradd -m -s /bin/bash hidden_elamar")).toBe(true);
      expect(regex.test("adduser attacker_user")).toBe(true);
      expect(regex.test("net user evil_admin Password123! /add")).toBe(true);
      expect(regex.test("systemctl restart nginx")).toBe(false);
    });

    it("GM-0008: should detect Critical Service Errors & Kernel Crashes", () => {
      const rule = DEFAULT_RULES.find((r) => r.code === "GM-0008");
      expect(rule).toBeDefined();
      const cfg = JSON.parse(rule!.config);
      const regex = new RegExp(cfg.pattern, "i");

      expect(regex.test("Kernel panic - not syncing: VFS: Unable to mount root fs")).toBe(true);
      expect(regex.test("Fatal error in worker thread")).toBe(true);
      expect(regex.test("Process killed: out of memory")).toBe(true);
      expect(regex.test("HTTP request processed in 12ms")).toBe(false);
    });
  });

  describe("Threshold Rules Configuration (GM-0001, GM-0005)", () => {
    it("GM-0001: SSH brute force threshold parameters should be valid", () => {
      const rule = DEFAULT_RULES.find((r) => r.code === "GM-0001");
      expect(rule).toBeDefined();
      const cfg = JSON.parse(rule!.config);

      expect(cfg.kind).toBe("threshold");
      expect(cfg.action).toBe("auth_failure");
      expect(cfg.count).toBe(5);
      expect(cfg.windowSec).toBe(300);
      expect(cfg.groupBy).toBe("srcIp");
    });

    it("GM-0005: Account password spray threshold parameters should be valid", () => {
      const rule = DEFAULT_RULES.find((r) => r.code === "GM-0005");
      expect(rule).toBeDefined();
      const cfg = JSON.parse(rule!.config);

      expect(cfg.kind).toBe("threshold");
      expect(cfg.action).toBe("auth_failure");
      expect(cfg.count).toBe(10);
      expect(cfg.windowSec).toBe(600);
      expect(cfg.groupBy).toBe("user");
    });
  });

  describe("Threat Intel IOC Correlation Rule (GM-0004)", () => {
    it("GM-0004: should be configured for srcIp and message matching", () => {
      const rule = DEFAULT_RULES.find((r) => r.code === "GM-0004");
      expect(rule).toBeDefined();
      const cfg = JSON.parse(rule!.config);

      expect(cfg.kind).toBe("ioc");
      expect(cfg.matchOn).toContain("srcIp");
      expect(cfg.matchOn).toContain("message");
    });
  });
});
