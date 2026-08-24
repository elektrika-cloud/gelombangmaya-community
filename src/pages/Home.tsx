import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import {
  Activity,
  Layers,
  AlertTriangle,
  ShieldCheck,
  Server,
  Globe,
  Radio,
  Clock,
  Trash2,
} from "lucide-react";
import { OverviewTab } from "../components/soc/OverviewTab";
import { EventsExplorerTab } from "../components/soc/EventsExplorerTab";
import { AlertsTriageTab } from "../components/soc/AlertsTriageTab";
import { RulesManagerTab } from "../components/soc/RulesManagerTab";
import { FleetMonitorTab } from "../components/soc/FleetMonitorTab";
import { ThreatIntelTab } from "../components/soc/ThreatIntelTab";
import { PurgeTelemetryModal } from "../components/soc/PurgeTelemetryModal";

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isPurgeOpen, setIsPurgeOpen] = useState<boolean>(false);

  // Ping backend engine health
  const { isSuccess: isEngineOnline } = trpc.ping.useQuery(undefined, {
    refetchInterval: 10000,
  });

  // Overview metrics for tab badges
  const { data: overview } = trpc.siem.overview.useQuery(undefined, {
    refetchInterval: 10000,
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toISOString().replace("T", " ").replace(/\..+/, "") + " UTC",
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalOpenAlerts =
    overview?.openBySev.reduce((acc, curr) => acc + Number(curr.n), 0) ?? 0;

  const navTabs = [
    {
      id: "overview",
      label: "Command Center",
      icon: Activity,
      badge: null,
      badgeColor: undefined,
    },
    {
      id: "events",
      label: "Live Telemetry",
      icon: Layers,
      badge: overview?.events24h ? `${overview.events24h.toLocaleString()}` : null,
      badgeColor: undefined,
    },
    {
      id: "alerts",
      label: "Incident Triage",
      icon: AlertTriangle,
      badge: totalOpenAlerts > 0 ? `${totalOpenAlerts}` : null,
      badgeColor: "bg-rose-500 text-white animate-pulse",
    },
    {
      id: "rules",
      label: "Detection Rules",
      icon: ShieldCheck,
      badge: overview?.rulesActive ? `${overview.rulesActive}` : null,
      badgeColor: undefined,
    },
    {
      id: "fleet",
      label: "Endpoint Fleet",
      icon: Server,
      badge: overview?.agentsOnline ? `${overview.agentsOnline}` : null,
      badgeColor: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
    },
    {
      id: "iocs",
      label: "Threat Intel IOC",
      icon: Globe,
      badge: null,
      badgeColor: undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-[#060a16] text-slate-100 flex flex-col font-sans">
      {/* Top HUD Status Bar */}
      <header className="bg-[#0b1329]/95 border-b border-slate-800 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 text-emerald-400 glow-emerald">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black tracking-wider uppercase bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
                    GelombangMaya
                  </h1>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    SIEM PROD
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Autonomous Threat Telemetry & SecOps Defense
                </p>
              </div>
            </div>

            {/* Right Status Indicators */}
            <div className="flex items-center gap-3">
              {/* Reset Data Button */}
              <button
                onClick={() => setIsPurgeOpen(true)}
                title="Padam / Reset Telemetri & Insiden Lalu"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-xs font-mono font-semibold transition shadow hover:shadow-rose-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">RESET DATA</span>
              </button>

              {/* Military Clock */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#060a16] border border-slate-800 text-xs font-mono text-slate-300">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{currentTime || "SYNCING..."}</span>
              </div>

              {/* Engine Health Badge */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#060a16] border border-slate-800 text-xs font-mono">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isEngineOnline ? "bg-emerald-500 animate-ping" : "bg-rose-500"
                  }`}
                />
                <span className="text-slate-300">
                  {isEngineOnline ? "ENGINE ONLINE" : "CONNECTING..."}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tab Bar */}
          <nav className="flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-800/80 -mx-4 px-4 sm:mx-0 sm:px-0">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow glow-emerald"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                        tab.badgeColor || "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main SOC Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "overview" && <OverviewTab onNavigateTab={(tab) => setActiveTab(tab)} />}
        {activeTab === "events" && <EventsExplorerTab />}
        {activeTab === "alerts" && <AlertsTriageTab />}
        {activeTab === "rules" && <RulesManagerTab />}
        {activeTab === "fleet" && <FleetMonitorTab />}
        {activeTab === "iocs" && <ThreatIntelTab />}
      </main>

      {/* Tactical Footer */}
      <footer className="bg-[#0b1329] border-t border-slate-800 py-3 text-[11px] font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>GelombangMaya Telemetry Engine</span>
            <span>•</span>
            <span>SecOps Threat Defense Operations</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Protocol: tRPC v11 / Drizzle ORM / Hono</span>
            <span>•</span>
            <span className="text-slate-400">Production Mode</span>
          </div>
        </div>
      </footer>

      {/* Purge / Reset Telemetry Modal */}
      <PurgeTelemetryModal
        isOpen={isPurgeOpen}
        onClose={() => setIsPurgeOpen(false)}
      />
    </div>
  );
}
