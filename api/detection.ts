import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { alerts, events, iocs, rules, type Event, type Rule } from "../db/schema";

type RuleConfig =
  | { kind: "match"; field: "message" | "srcIp" | "user" | "source" | "action"; pattern: string }
  | { kind: "threshold"; action: string; count: number; windowSec: number; groupBy: "srcIp" | "user" }
  | { kind: "ioc"; matchOn: ("srcIp" | "message")[] };

function parseConfig(rule: Rule): RuleConfig | null {
  try {
    return JSON.parse(rule.config) as RuleConfig;
  } catch {
    return null;
  }
}

async function raiseAlert(
  rule: Rule,
  ev: Event,
  detail: string,
  eventCount = 1,
) {
  const db = getDb();
  await db.insert(alerts).values({
    ruleId: rule.id,
    agentId: ev.agentId ?? null,
    title: `${rule.name}`,
    severity: rule.severity,
    detail,
    srcIp: ev.srcIp ?? null,
    eventCount,
  });
  await db
    .update(rules)
    .set({ hits: sql`${rules.hits} + 1` })
    .where(eq(rules.id, rule.id));
}

/**
 * Core detection pipeline — runs synchronously for every ingested event.
 * Returns number of alerts raised.
 */
export async function evaluateEvent(ev: Event): Promise<number> {
  const db = getDb();

  // Auto-enrich action, user, and srcIp if missing from raw event log
  if (!ev.action) {
    if (/(Failed password|authentication failure|Invalid user|Failed publickey|maximum authentication attempts|Connection closed by authenticating user|pam_unix.*authentication failure)/i.test(ev.message)) {
      ev.action = "auth_failure";
    } else if (/(Accepted password|Accepted publickey|session opened for user)/i.test(ev.message)) {
      ev.action = "auth_success";
    } else if (/(sudo:\s+\S+\s+:|COMMAND=)/i.test(ev.message)) {
      ev.action = "privilege_escalation";
    }
  }

  if (!ev.srcIp) {
    const ipMatch = ev.message.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
    if (ipMatch && ipMatch.length > 0) {
      const extIps = ipMatch.filter((ip) => !ip.startsWith("127.") && ip !== "0.0.0.0");
      ev.srcIp = extIps[extIps.length - 1] || ipMatch[ipMatch.length - 1];
    }
  }

  if (!ev.user) {
    const userMatch = ev.message.match(/for (?:invalid user )?(\S+) from|user[= ]([a-zA-Z0-9_\-]+)/i);
    if (userMatch) {
      ev.user = userMatch[1] || userMatch[2];
    }
  }

  const enabledRules = await db.select().from(rules).where(eq(rules.enabled, true));
  let raised = 0;

  for (const rule of enabledRules) {
    const cfg = parseConfig(rule);
    if (!cfg) continue;

    if (rule.kind === "match" && cfg.kind === "match") {
      const fieldVal = (ev[cfg.field] ?? "") as string;
      if (!fieldVal) continue;
      let re: RegExp;
      try {
        re = new RegExp(cfg.pattern, "i");
      } catch {
        continue;
      }
      if (re.test(fieldVal)) {
        await raiseAlert(rule, ev, `Pattern \`${cfg.pattern}\` matched ${cfg.field}: ${fieldVal.slice(0, 300)}`);
        raised++;
      }
    }

    if (rule.kind === "threshold" && cfg.kind === "threshold") {
      if (ev.action !== cfg.action) continue;
      const groupVal = cfg.groupBy === "srcIp" ? ev.srcIp : ev.user;
      if (!groupVal) continue;
      const since = new Date(Date.now() - cfg.windowSec * 1000);
      const groupCol = cfg.groupBy === "srcIp" ? events.srcIp : events.user;
      const rows = await db
        .select({ n: sql<number>`count(*)` })
        .from(events)
        .where(and(eq(events.action, cfg.action), eq(groupCol, groupVal), gte(events.eventAt, since)));
      const n = Number(rows[0]?.n ?? 0);
      if (n >= cfg.count) {
        const alertFilter =
          cfg.groupBy === "srcIp"
            ? and(eq(alerts.ruleId, rule.id), eq(alerts.status, "open"), eq(alerts.srcIp, groupVal))
            : and(eq(alerts.ruleId, rule.id), eq(alerts.status, "open"));

        const existing = await db
          .select({ id: alerts.id, eventCount: alerts.eventCount })
          .from(alerts)
          .where(alertFilter);

        if (existing.length > 0) {
          // Update eventCount on open alert for live attack escalation
          await db
            .update(alerts)
            .set({
              eventCount: n,
              detail: `Threshold exceeded: ${n} × ${cfg.action} by ${cfg.groupBy}=${groupVal} within ${cfg.windowSec}s`,
              updatedAt: new Date(),
            })
            .where(eq(alerts.id, existing[0].id));
          continue;
        }

        await raiseAlert(
          rule,
          ev,
          `Threshold exceeded: ${n} × ${cfg.action} by ${cfg.groupBy}=${groupVal} within ${cfg.windowSec}s`,
          n,
        );
        raised++;
      }
    }

    if (rule.kind === "ioc" && cfg.kind === "ioc") {
      const allIocs = await db.select().from(iocs);
      for (const ioc of allIocs) {
        const hit =
          (cfg.matchOn.includes("srcIp") && ev.srcIp === ioc.value) ||
          (cfg.matchOn.includes("message") && ev.message.includes(ioc.value));
        if (hit) {
          await raiseAlert(
            rule,
            ev,
            `IOC match (${ioc.type}): ${ioc.value}${ioc.description ? ` — ${ioc.description}` : ""}`,
          );
          raised++;
          break; // one alert per rule per event
        }
      }
    }
  }
  return raised;
}

/** Default ruleset seeded on first run */
export const DEFAULT_RULES: Array<{
  code: string; name: string; description: string;
  severity: "low" | "medium" | "high" | "critical";
  kind: "match" | "threshold" | "ioc"; config: string;
}> = [
  {
    code: "GM-0001", name: "SSH Brute Force", description: "5+ SSH auth failures from one IP within 5 minutes",
    severity: "high", kind: "threshold",
    config: JSON.stringify({ kind: "threshold", action: "auth_failure", count: 5, windowSec: 300, groupBy: "srcIp" }),
  },
  {
    code: "GM-0002", name: "Privilege Escalation", description: "sudo/su usage to root detected",
    severity: "high", kind: "match",
    config: JSON.stringify({ kind: "match", field: "message", pattern: "(sudo|su).*(root|COMMAND)" }),
  },
  {
    code: "GM-0003", name: "Web Attack Signature", description: "SQLi / XSS / path traversal pattern in web logs",
    severity: "critical", kind: "match",
    config: JSON.stringify({ kind: "match", field: "message", pattern: "(union\\s+select|or\\s+1=1|<script|\\.\\./\\.\\./|/etc/passwd|xp_cmdshell)" }),
  },
  {
    code: "GM-0004", name: "Known Malicious IOC", description: "Event matches a threat-intel indicator",
    severity: "critical", kind: "ioc",
    config: JSON.stringify({ kind: "ioc", matchOn: ["srcIp", "message"] }),
  },
  {
    code: "GM-0005", name: "Account Password Spray", description: "10+ auth failures on one user within 10 minutes",
    severity: "high", kind: "threshold",
    config: JSON.stringify({ kind: "threshold", action: "auth_failure", count: 10, windowSec: 600, groupBy: "user" }),
  },
  {
    code: "GM-0006", name: "Sensitive File Access", description: "Access to shadow/passwd/key files",
    severity: "medium", kind: "match",
    config: JSON.stringify({ kind: "match", field: "message", pattern: "(/etc/shadow|/etc/passwd|id_rsa|\\.pem)" }),
  },
  {
    code: "GM-0007", name: "New Local Account Created", description: "useradd / adduser execution detected",
    severity: "medium", kind: "match",
    config: JSON.stringify({ kind: "match", field: "message", pattern: "(useradd|adduser|net user .+ /add)" }),
  },
  {
    code: "GM-0008", name: "Critical Service Error", description: "Any critical-level event is surfaced",
    severity: "low", kind: "match",
    config: JSON.stringify({ kind: "match", field: "message", pattern: "(panic|fatal|segfault|out of memory)" }),
  },
];
