import { getDb } from "./queries/connection";
import { sql } from "drizzle-orm";
import { rules } from "../db/schema";
import { DEFAULT_RULES } from "./detection";

let done = false;

/**
 * Idempotent schema bootstrap — creates tables if missing and seeds the
 * default GelombangMaya ruleset. Safe to call on every cold start.
 */
export async function ensureSchema() {
  if (done) return;
  const db = getDb();
  const ddl = [
    `CREATE TABLE IF NOT EXISTS agents (
      id bigint unsigned auto_increment PRIMARY KEY,
      name varchar(128) NOT NULL UNIQUE,
      hostname varchar(255), ip varchar(64), os varchar(128), version varchar(64),
      status enum('online','offline','degraded') NOT NULL DEFAULT 'offline',
      last_seen_at timestamp NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS events (
      id bigint unsigned auto_increment PRIMARY KEY,
      agent_id bigint unsigned, source varchar(128) NOT NULL,
      level enum('debug','info','notice','warning','error','critical') NOT NULL DEFAULT 'info',
      message text NOT NULL, src_ip varchar(64), dst_ip varchar(64),
      \`user\` varchar(128), action varchar(128), metadata text,
      event_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_events_event_at (event_at), INDEX idx_events_src_ip (src_ip),
      INDEX idx_events_action (action), INDEX idx_events_source (source)
    )`,
    `CREATE TABLE IF NOT EXISTS rules (
      id bigint unsigned auto_increment PRIMARY KEY,
      code varchar(32) NOT NULL UNIQUE, name varchar(255) NOT NULL,
      description text,
      severity enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
      kind enum('match','threshold','ioc') NOT NULL,
      config text NOT NULL, enabled boolean NOT NULL DEFAULT true,
      hits int NOT NULL DEFAULT 0, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS alerts (
      id bigint unsigned auto_increment PRIMARY KEY,
      rule_id bigint unsigned, agent_id bigint unsigned,
      title varchar(255) NOT NULL,
      severity enum('low','medium','high','critical') NOT NULL,
      status enum('open','acknowledged','resolved','false_positive') NOT NULL DEFAULT 'open',
      detail text, src_ip varchar(64), event_count int NOT NULL DEFAULT 1,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_alerts_status (status), INDEX idx_alerts_created (created_at)
    )`,
    `CREATE TABLE IF NOT EXISTS iocs (
      id bigint unsigned auto_increment PRIMARY KEY,
      type enum('ip','domain','hash','url') NOT NULL,
      value varchar(512) NOT NULL UNIQUE, description varchar(512),
      severity enum('low','medium','high','critical') NOT NULL DEFAULT 'high',
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ];
  for (const stmt of ddl) await db.execute(sql.raw(stmt));
  const existing = await db.select().from(rules).limit(1);
  if (existing.length === 0) {
    for (const r of DEFAULT_RULES) await db.insert(rules).values(r);
  }
  done = true;
  console.log("[GelombangMaya] schema ready, ruleset loaded");
}
