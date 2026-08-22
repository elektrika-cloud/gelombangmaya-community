import { z } from "zod";
import { and, desc, eq, gte, like, or, sql, count } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { agents, alerts, events, iocs, rules, type Event } from "../db/schema";
import { evaluateEvent, DEFAULT_RULES } from "./detection";

const LEVELS = ["debug", "info", "notice", "warning", "error", "critical"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const ingestEventSchema = z.object({
  agentName: z.string().min(1).max(128),
  agent: z
    .object({
      hostname: z.string().nullable().optional(),
      ip: z.string().nullable().optional(),
      os: z.string().nullable().optional(),
      version: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  source: z.string().min(1).max(128),
  level: z.enum(LEVELS).default("info"),
  message: z.string().min(1),
  srcIp: z.string().nullable().optional(),
  dstIp: z.string().nullable().optional(),
  user: z.string().nullable().optional(),
  action: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  eventAt: z.coerce.date().nullable().optional(),
});

async function upsertAgent(
  db: ReturnType<typeof getDb>,
  name: string,
  meta?: { hostname?: string | null; ip?: string | null; os?: string | null; version?: string | null } | null,
): Promise<number | null> {
  try {
    const existing = await db.select().from(agents).where(eq(agents.name, name)).limit(1);
    if (existing.length > 0) {
      await db.update(agents).set({ status: "online", lastSeenAt: new Date() }).where(eq(agents.id, existing[0].id));
      return existing[0].id;
    }
    const res = await db.insert(agents).values({
      name,
      hostname: meta?.hostname ?? null,
      ip: meta?.ip ?? null,
      os: meta?.os ?? null,
      version: meta?.version ?? null,
      status: "online",
      lastSeenAt: new Date(),
    });
    const insertId = Number(res[0]?.insertId);
    if (insertId > 0) return insertId;
  } catch {
    // On duplicate entry or concurrent collision, re-fetch existing agent
    try {
      const existing = await db.select().from(agents).where(eq(agents.name, name)).limit(1);
      if (existing.length > 0) {
        return existing[0].id;
      }
    } catch {
      // pass
    }
  }
  return null;
}

export const siemRouter = createRouter({
  // ---------- INGESTION ----------
  ingest: publicQuery.input(ingestEventSchema).mutation(async ({ input }) => {
    const db = getDb();
    const agentId = await upsertAgent(db, input.agentName, input.agent);
    const eventTime = input.eventAt ?? new Date();
    const res = await db.insert(events).values({
      agentId,
      source: input.source,
      level: input.level,
      message: input.message,
      srcIp: input.srcIp ?? null,
      dstIp: input.dstIp ?? null,
      user: input.user ?? null,
      action: input.action ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      eventAt: eventTime,
    });

    const eventId = Number(res[0]?.insertId ?? 0);
    const evList = eventId > 0 ? await db.select().from(events).where(eq(events.id, eventId)).limit(1) : [];
    const ev: Event = evList[0] ?? {
      id: eventId,
      agentId,
      source: input.source,
      level: input.level,
      message: input.message,
      srcIp: input.srcIp ?? null,
      dstIp: input.dstIp ?? null,
      user: input.user ?? null,
      action: input.action ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      eventAt: eventTime,
      createdAt: new Date(),
    };

    let alertsRaised = 0;
    try {
      alertsRaised = await evaluateEvent(ev);
    } catch (err) {
      console.error("[GelombangMaya Detection Error]", err);
    }

    return { eventId: ev.id, alertsRaised };
  }),

  ingestBatch: publicQuery.input(z.object({ events: z.array(ingestEventSchema).min(1).max(500) })).mutation(async ({ input }) => {
    let alertsRaised = 0;
    const ids: number[] = [];
    const db = getDb();
    for (const e of input.events) {
      const agentId = await upsertAgent(db, e.agentName, e.agent);
      const eventTime = e.eventAt ?? new Date();
      const res = await db.insert(events).values({
        agentId,
        source: e.source,
        level: e.level,
        message: e.message,
        srcIp: e.srcIp ?? null,
        dstIp: e.dstIp ?? null,
        user: e.user ?? null,
        action: e.action ?? null,
        metadata: e.metadata ? JSON.stringify(e.metadata) : null,
        eventAt: eventTime,
      });

      const eventId = Number(res[0]?.insertId ?? 0);
      const ev: Event = {
        id: eventId,
        agentId,
        source: e.source,
        level: e.level,
        message: e.message,
        srcIp: e.srcIp ?? null,
        dstIp: e.dstIp ?? null,
        user: e.user ?? null,
        action: e.action ?? null,
        metadata: e.metadata ? JSON.stringify(e.metadata) : null,
        eventAt: eventTime,
        createdAt: new Date(),
      };

      try {
        alertsRaised += await evaluateEvent(ev);
      } catch (err) {
        console.error("[GelombangMaya Batch Detection Error]", err);
      }
      ids.push(eventId);
    }
    return { ingested: ids.length, alertsRaised };
  }),

  // ---------- DASHBOARD STATS ----------
  overview: publicQuery.query(async () => {
    const db = getDb();
    const day = new Date(Date.now() - 24 * 3600 * 1000);
    const [ev24] = await db.select({ n: count() }).from(events).where(gte(events.eventAt, day));
    const [evTotal] = await db.select({ n: count() }).from(events);
    const openBySev = await db
      .select({ severity: alerts.severity, n: count() })
      .from(alerts)
      .where(eq(alerts.status, "open"))
      .groupBy(alerts.severity);
    const [agentsOnline] = await db.select({ n: count() }).from(agents).where(eq(agents.status, "online"));
    const [agentsTotal] = await db.select({ n: count() }).from(agents);
    const [rulesActive] = await db.select({ n: count() }).from(rules).where(eq(rules.enabled, true));
    const topSources = await db
      .select({ source: events.source, n: count() })
      .from(events)
      .where(gte(events.eventAt, day))
      .groupBy(events.source)
      .orderBy(desc(count()))
      .limit(6);
    const topSrcIps = await db
      .select({ srcIp: events.srcIp, n: count() })
      .from(events)
      .where(and(gte(events.eventAt, day), sql`${events.srcIp} is not null`))
      .groupBy(events.srcIp)
      .orderBy(desc(count()))
      .limit(6);
    return {
      events24h: ev24.n, eventsTotal: evTotal.n, openBySev,
      agentsOnline: agentsOnline.n, agentsTotal: agentsTotal.n,
      rulesActive: rulesActive.n, topSources, topSrcIps,
    };
  }),

  timeline: publicQuery.input(z.object({ hours: z.number().min(1).max(168).default(24) })).query(async ({ input }) => {
    const db = getDb();
    const since = new Date(Date.now() - input.hours * 3600 * 1000);
    const rows = await db
      .select({
        bucket: sql<string>`date_format(${events.eventAt}, '%Y-%m-%d %H:00')`,
        n: count(),
      })
      .from(events)
      .where(gte(events.eventAt, since))
      .groupBy(sql`bucket`)
      .orderBy(sql`bucket`);
    const alertRows = await db
      .select({
        bucket: sql<string>`date_format(${alerts.createdAt}, '%Y-%m-%d %H:00')`,
        n: count(),
      })
      .from(alerts)
      .where(gte(alerts.createdAt, since))
      .groupBy(sql`bucket`)
      .orderBy(sql`bucket`);
    return { events: rows, alerts: alertRows };
  }),

  // ---------- EVENTS ----------
  listEvents: publicQuery
    .input(z.object({
      q: z.string().optional(),
      level: z.enum(LEVELS).optional(),
      source: z.string().optional(),
      action: z.string().optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [];
      if (input.q) conds.push(or(like(events.message, `%${input.q}%`), like(events.srcIp, `%${input.q}%`), like(events.user, `%${input.q}%`)));
      if (input.level) conds.push(eq(events.level, input.level));
      if (input.source) conds.push(eq(events.source, input.source));
      if (input.action) conds.push(eq(events.action, input.action));
      const where = conds.length ? and(...conds) : undefined;
      const rows = await db
        .select({ event: events, agentName: agents.name })
        .from(events)
        .leftJoin(agents, eq(events.agentId, agents.id))
        .where(where)
        .orderBy(desc(events.eventAt))
        .limit(input.limit)
        .offset(input.offset);
      const [total] = await db.select({ n: count() }).from(events).where(where);
      return { rows, total: total.n };
    }),

  // ---------- ALERTS ----------
  listAlerts: publicQuery
    .input(z.object({
      status: z.enum(["open", "acknowledged", "resolved", "false_positive"]).optional(),
      severity: z.enum(SEVERITIES).optional(),
      limit: z.number().min(1).max(200).default(50),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [];
      if (input.status) conds.push(eq(alerts.status, input.status));
      if (input.severity) conds.push(eq(alerts.severity, input.severity));
      const where = conds.length ? and(...conds) : undefined;
      return db
        .select({ alert: alerts, ruleCode: rules.code, agentName: agents.name })
        .from(alerts)
        .leftJoin(rules, eq(alerts.ruleId, rules.id))
        .leftJoin(agents, eq(alerts.agentId, agents.id))
        .where(where)
        .orderBy(desc(alerts.createdAt))
        .limit(input.limit);
    }),

  updateAlertStatus: publicQuery
    .input(z.object({ id: z.number(), status: z.enum(["open", "acknowledged", "resolved", "false_positive"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(alerts).set({ status: input.status }).where(eq(alerts.id, input.id));
      return { ok: true };
    }),

  // ---------- RULES ----------
  listRules: publicQuery.query(async () => {
    return getDb().select().from(rules).orderBy(rules.code);
  }),

  toggleRule: publicQuery.input(z.object({ id: z.number(), enabled: z.boolean() })).mutation(async ({ input }) => {
    await getDb().update(rules).set({ enabled: input.enabled }).where(eq(rules.id, input.id));
    return { ok: true };
  }),

  createRule: publicQuery
    .input(z.object({
      code: z.string().min(2).max(32),
      name: z.string().min(2).max(255),
      description: z.string().optional(),
      severity: z.enum(SEVERITIES),
      kind: z.enum(["match", "threshold", "ioc"]),
      config: z.string(), // JSON
    }))
    .mutation(async ({ input }) => {
      JSON.parse(input.config); // validate
      await getDb().insert(rules).values(input);
      return { ok: true };
    }),

  deleteRule: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await getDb().delete(rules).where(eq(rules.id, input.id));
    return { ok: true };
  }),

  seedDefaultRules: publicQuery.mutation(async () => {
    const db = getDb();
    const existing = await db.select({ n: count() }).from(rules);
    if (existing[0].n > 0) return { seeded: false };
    for (const r of DEFAULT_RULES) await db.insert(rules).values(r);
    return { seeded: true, count: DEFAULT_RULES.length };
  }),

  // ---------- AGENTS ----------
  listAgents: publicQuery.query(async () => {
    return getDb().select().from(agents).orderBy(desc(agents.lastSeenAt));
  }),

  heartbeat: publicQuery
    .input(z.object({ name: z.string(), hostname: z.string().optional(), ip: z.string().optional(), os: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await upsertAgent(db, input.name, input);
      return { ok: true, ts: Date.now() };
    }),

  // ---------- IOCs ----------
  listIocs: publicQuery.query(async () => {
    return getDb().select().from(iocs).orderBy(desc(iocs.createdAt));
  }),

  addIoc: publicQuery
    .input(z.object({
      type: z.enum(["ip", "domain", "hash", "url"]),
      value: z.string().min(1).max(512),
      description: z.string().optional(),
      severity: z.enum(SEVERITIES).default("high"),
    }))
    .mutation(async ({ input }) => {
      await getDb().insert(iocs).values(input);
      return { ok: true };
    }),

  deleteIoc: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await getDb().delete(iocs).where(eq(iocs.id, input.id));
    return { ok: true };
  }),

  // ---------- RESET / PURGE TELEMETRY ----------
  resetTelemetry: publicQuery
    .input(
      z
        .object({
          purgeEvents: z.boolean().default(true),
          purgeAlerts: z.boolean().default(true),
          resetRuleHits: z.boolean().default(true),
          resetAgents: z.boolean().default(false),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const purgeEvents = input?.purgeEvents ?? true;
      const purgeAlerts = input?.purgeAlerts ?? true;
      const resetRuleHits = input?.resetRuleHits ?? true;
      const resetAgents = input?.resetAgents ?? false;

      if (purgeAlerts) {
        await db.delete(alerts);
      }
      if (purgeEvents) {
        await db.delete(events);
      }
      if (resetRuleHits) {
        await db.update(rules).set({ hits: 0 });
      }
      if (resetAgents) {
        await db.delete(agents);
      }

      return {
        ok: true,
        purgedAlerts: purgeAlerts,
        purgedEvents: purgeEvents,
        resetRuleHits,
        resetAgents,
        timestamp: new Date().toISOString(),
      };
    }),
});
