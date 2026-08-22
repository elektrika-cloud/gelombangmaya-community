import dgram from "node:dgram";
import { eq } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { agents, events } from "../db/schema";
import { evaluateEvent } from "./detection";

const SYSLOG_PORT = parseInt(process.env.SYSLOG_PORT || "1514", 10);
const SYSLOG_HOST = process.env.SYSLOG_HOST || "0.0.0.0";

const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const SSH_USER_RE = /for (?:invalid user )?(\S+) from|user[= ]([a-zA-Z0-9_\-]+)/i;

interface ParsedSyslog {
  facility: number;
  severity: number;
  level: "debug" | "info" | "notice" | "warning" | "error" | "critical";
  hostname: string;
  source: string;
  message: string;
  srcIp?: string;
  user?: string;
  action?: string;
}

function parseSyslogMessage(raw: string, senderIp: string): ParsedSyslog {
  let text = raw.trim();
  let facility = 1; // user-level default
  let severity = 6; // info default

  // Parse PRI header: <34>...
  const priMatch = text.match(/^<(\d{1,3})>/);
  if (priMatch) {
    const pri = parseInt(priMatch[1], 10);
    facility = Math.floor(pri / 8);
    severity = pri % 8;
    text = text.slice(priMatch[0].length).trim();
  }

  // Map syslog numeric severity (0-7) to SIEM levels
  let level: "debug" | "info" | "notice" | "warning" | "error" | "critical" = "info";
  if (severity <= 2) level = "critical";
  else if (severity === 3) level = "error";
  else if (severity === 4) level = "warning";
  else if (severity === 5) level = "notice";
  else if (severity === 6) level = "info";
  else level = "debug";

  // Parse Header: [Timestamp] [Hostname] [tag/proc]: [msg]
  let hostname = senderIp;
  let source = "syslog";

  // Example: Oct 11 22:14:15 myhost sshd[1234]: Failed password for root from 1.2.3.4
  const headerMatch = text.match(/^(?:[A-Z][a-z]{2}\s+\d+\s+\d+:\d+:\d+|\d{4}-\d{2}-\d{2}T[^\s]+)\s+([^\s:]+)\s+([^:\[\s]+)(?:\[\d+\])?:\s*(.*)$/);
  if (headerMatch) {
    hostname = headerMatch[1];
    source = headerMatch[2].toLowerCase();
    text = headerMatch[3];
  } else {
    const simpleMatch = text.match(/^([^:\[\s]+)(?:\[\d+\])?:\s*(.*)$/);
    if (simpleMatch) {
      source = simpleMatch[1].toLowerCase();
      text = simpleMatch[2];
    }
  }

  // Detect Action & Extract Attacker IPs
  let action: string | undefined;
  if (/(failed password|authentication failure|invalid user|failed publickey|maximum authentication attempts)/i.test(text)) {
    action = "auth_failure";
    level = "warning";
  } else if (/(accepted password|accepted publickey|session opened)/i.test(text)) {
    action = "auth_success";
  } else if (/(sudo:\s+\S+\s+:|command=)/i.test(text)) {
    action = "privilege_escalation";
    level = "notice";
  }

  // Extract IP
  const ips = text.match(IP_RE);
  let srcIp: string | undefined = undefined;
  if (ips && ips.length > 0) {
    const extIps = ips.filter((ip) => !ip.startsWith("127.") && ip !== "0.0.0.0");
    srcIp = extIps[extIps.length - 1] || ips[ips.length - 1];
  } else if (senderIp && !senderIp.startsWith("127.") && senderIp !== "0.0.0.0") {
    srcIp = senderIp;
  }

  // Extract User
  let user: string | undefined = undefined;
  const userMatch = text.match(SSH_USER_RE);
  if (userMatch) {
    user = userMatch[1] || userMatch[2];
  }

  return {
    facility,
    severity,
    level,
    hostname,
    source,
    message: text,
    srcIp,
    user,
    action,
  };
}

let syslogServer: dgram.Socket | null = null;

export function startSyslogServer(): void {
  if (syslogServer) return;

  try {
    const server = dgram.createSocket("udp4");

    server.on("error", (err) => {
      console.error(`[GelombangMaya Syslog] UDP listener error: ${err.message}`);
      server.close();
      syslogServer = null;
    });

    server.on("message", async (msg, rinfo) => {
      try {
        const raw = msg.toString("utf-8");
        const parsed = parseSyslogMessage(raw, rinfo.address);

        const db = getDb();
        const res = await db.insert(events).values({
          source: parsed.source,
          level: parsed.level,
          message: parsed.message,
          srcIp: parsed.srcIp,
          user: parsed.user,
          action: parsed.action,
          metadata: JSON.stringify({
            ingest: "syslog-udp",
            facility: parsed.facility,
            senderIp: rinfo.address,
            senderPort: rinfo.port,
          }),
          eventAt: new Date(),
        });

        const ev = (await db.select().from(events).where(eq(events.id, Number(res[0].insertId))))[0];
        if (ev) {
          const alertsRaised = await evaluateEvent(ev);
          if (alertsRaised > 0) {
            console.log(`[GelombangMaya Syslog] 🚨 ${alertsRaised} alert(s) raised from syslog event: ${ev.message.slice(0, 80)}`);
          }
        }
      } catch (e) {
        console.error("[GelombangMaya Syslog] Failed to process incoming syslog frame:", e);
      }
    });

    server.on("listening", () => {
      const addr = server.address();
      console.log(`[GelombangMaya Syslog] 📡 UDP Syslog listener online on ${addr.address}:${addr.port}`);
    });

    server.bind(SYSLOG_PORT, SYSLOG_HOST);
    syslogServer = server;
  } catch (err) {
    console.error("[GelombangMaya Syslog] Could not start UDP syslog listener:", err);
  }
}

export function stopSyslogServer(): void {
  if (syslogServer) {
    syslogServer.close();
    syslogServer = null;
  }
}
