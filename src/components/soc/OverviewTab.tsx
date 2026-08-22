import React, { useState } from "react";
import { trpc } from "../../lib/trpc";
import {
  Activity,
  AlertTriangle,
  Server,
  ShieldCheck,
  Flame,
  ArrowUpRight,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { ContainmentModal } from "./ContainmentModal";

interface OverviewTabProps {
  onNavigateTab: (tab: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ onNavigateTab }) => {
  const [selectedIpForContainment, setSelectedIpForContainment] = useState<string | null>(null);

  const { data: overview, isLoading: loadingOverview } =
    trpc.siem.overview.useQuery(undefined, { refetchInterval: 10000 });

  const { data: timeline, isLoading: loadingTimeline } =
    trpc.siem.timeline.useQuery({ hours: 24 }, { refetchInterval: 15000 });

  // Calculate severity counters
  const criticalCount = overview?.openBySev.find((s) => s.severity === "critical")?.n ?? 0;
  const highCount = overview?.openBySev.find((s) => s.severity === "high")?.n ?? 0;
  const mediumCount = overview?.openBySev.find((s) => s.severity === "medium")?.n ?? 0;
  const lowCount = overview?.openBySev.find((s) => s.severity === "low")?.n ?? 0;
  const totalOpenAlerts = criticalCount + highCount + mediumCount + lowCount;

  // Max count for timeline scale
  const maxEventsTimeline = Math.max(...(timeline?.events.map((e) => Number(e.n)) || [1]), 1);

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Events */}
        <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Telemetry (24h)
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">
              {loadingOverview ? "..." : (overview?.events24h ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">
              / {loadingOverview ? "..." : (overview?.eventsTotal ?? 0).toLocaleString()} total
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Live Ingestion</span>
          </div>
        </div>

        {/* Open Alerts / Incidents */}
        <div
          onClick={() => onNavigateTab("alerts")}
          className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur hover:border-rose-500/50 cursor-pointer transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Open Alerts
            </span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:glow-rose transition">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-rose-400">
              {loadingOverview ? "..." : totalOpenAlerts}
            </span>
            <span className="text-xs text-slate-400">active triage</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            {criticalCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold font-mono">
                {criticalCount} CRIT
              </span>
            )}
            {highCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold font-mono">
                {highCount} HIGH
              </span>
            )}
            {mediumCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-mono">
                {mediumCount} MED
              </span>
            )}
            {totalOpenAlerts === 0 && (
              <span className="text-emerald-400 font-medium">All Clear</span>
            )}
          </div>
        </div>

        {/* Fleet Nodes */}
        <div
          onClick={() => onNavigateTab("fleet")}
          className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur hover:border-cyan-500/50 cursor-pointer transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Fleet Nodes
            </span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-cyan-400">
              {loadingOverview ? "..." : overview?.agentsOnline ?? 0}
            </span>
            <span className="text-xs text-slate-400">
              / {loadingOverview ? "..." : overview?.agentsTotal ?? 0} online
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
            <span>Forwarder agents connected</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
          </div>
        </div>

        {/* Detection Rules */}
        <div
          onClick={() => onNavigateTab("rules")}
          className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur hover:border-emerald-500/50 cursor-pointer transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Detection Rules
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-400">
              {loadingOverview ? "..." : overview?.rulesActive ?? 0}
            </span>
            <span className="text-xs text-slate-400">active heuristics</span>
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
            <span>Match + Threshold + IOC</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* 24-Hour Timeline Stream */}
      <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              24-Hour Telemetry & Ingestion Volume
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {timeline?.events.length ?? 0} active hourly buckets
          </span>
        </div>

        {loadingTimeline ? (
          <div className="h-32 flex items-center justify-center text-xs text-slate-500 font-mono">
            Loading telemetry metrics...
          </div>
        ) : timeline?.events.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-xs text-slate-500 font-mono">
            <span>No telemetry recorded in the last 24h.</span>
            <span className="text-[11px] text-slate-600 mt-1">
              Connect an endpoint with <code>gm-forwarder.py</code> to stream logs.
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="h-36 flex items-end gap-1.5 pt-4 pb-2 border-b border-slate-800/80">
              {timeline?.events.map((b, idx) => {
                const count = Number(b.n);
                const heightPercent = Math.max((count / maxEventsTimeline) * 100, 8);
                const alertMatch = timeline.alerts.find((a) => a.bucket === b.bucket);
                const alertCount = alertMatch ? Number(alertMatch.n) : 0;

                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative"
                  >
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 bg-[#060a16] border border-slate-700 text-white text-[11px] rounded px-2 py-1 pointer-events-none whitespace-nowrap z-20 shadow-xl font-mono">
                      <div>{b.bucket}</div>
                      <div className="text-emerald-400 font-bold">{count} events</div>
                      {alertCount > 0 && (
                        <div className="text-rose-400 font-bold">{alertCount} alerts</div>
                      )}
                    </div>

                    {/* Alert Marker if any */}
                    {alertCount > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mb-1 animate-ping" />
                    )}

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t transition-all ${
                        alertCount > 0
                          ? "bg-rose-500/80 group-hover:bg-rose-400"
                          : "bg-emerald-500/60 group-hover:bg-emerald-400"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-1">
              <span>24 hours ago</span>
              <span>Present</span>
            </div>
          </div>
        )}
      </div>

      {/* Two Column Grid: Top Sources & Top Attacker IPs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Log Sources */}
        <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              Top Log Sources (24h)
            </h3>
            <button
              onClick={() => onNavigateTab("events")}
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
            >
              View all
            </button>
          </div>

          {loadingOverview ? (
            <div className="text-xs text-slate-500 py-4 font-mono">Scanning sources...</div>
          ) : !overview?.topSources || overview.topSources.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center font-mono">
              No sources logged yet
            </div>
          ) : (
            <div className="space-y-3">
              {overview.topSources.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between bg-[#060a16] p-2.5 rounded-lg border border-slate-800/80">
                  <span className="font-mono text-xs text-slate-200 font-semibold">{s.source}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {Number(s.n).toLocaleString()} events
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Flagged / Origin IPs */}
        <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Active Source IPs & Threats
            </h3>
            <span className="text-xs text-slate-400 font-mono">Auto-Triage Ready</span>
          </div>

          {loadingOverview ? (
            <div className="text-xs text-slate-500 py-4 font-mono">Loading IP analytics...</div>
          ) : !overview?.topSrcIps || overview.topSrcIps.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center font-mono">
              No remote IP traffic recorded yet
            </div>
          ) : (
            <div className="space-y-2.5">
              {overview.topSrcIps.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-[#060a16] p-2.5 rounded-lg border border-slate-800/80 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400" />
                    <span className="font-mono text-xs text-slate-200 font-bold">{item.srcIp}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">
                      {Number(item.n).toLocaleString()} hits
                    </span>
                    <button
                      onClick={() => setSelectedIpForContainment(item.srcIp)}
                      className="px-2 py-1 text-[11px] font-medium rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition"
                    >
                      Contain IP
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Containment Modal */}
      {selectedIpForContainment && (
        <ContainmentModal
          ip={selectedIpForContainment}
          onClose={() => setSelectedIpForContainment(null)}
        />
      )}
    </div>
  );
};
