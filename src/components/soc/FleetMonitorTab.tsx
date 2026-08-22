import React, { useState, useEffect } from "react";
import { trpc } from "../../lib/trpc";
import { formatDate, formatTimeAgo } from "../../lib/utils";
import {
  Server,
  Terminal,
  Copy,
  Check,
  Activity,
  RefreshCw,
} from "lucide-react";

export const FleetMonitorTab: React.FC = () => {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [agentNameInput, setAgentNameInput] = useState("prod-web-01");
  const [logPathInput, setLogPathInput] = useState("/var/log/auth.log");
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const { data: agentsList, isLoading, refetch, isFetching } = trpc.siem.listAgents.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const getStatusBadge = (status: string, lastSeen: Date | null) => {
    // If last seen is older than 2 minutes, mark as degraded/offline
    const isStale = lastSeen ? nowMs - new Date(lastSeen).getTime() > 120000 : true;

    if (status === "online" && !isStale) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          ONLINE
        </span>
      );
    }
    if (status === "online" && isStale) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
          STALE
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
        OFFLINE
      </span>
    );
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const quickRunCmd = `python3 scripts/gm-forwarder.py --server http://localhost:3000 --name ${agentNameInput} --file ${logPathInput} --source sshd`;

  const systemdService = `[Unit]
Description=GelombangMaya Endpoint Log Forwarder Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/gelombangmaya
ExecStart=/usr/bin/python3 /opt/gelombangmaya/scripts/gm-forwarder.py --server http://localhost:3000 --name ${agentNameInput} --file ${logPathInput} --source syslog
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target`;

  return (
    <div className="space-y-6">
      {/* Fleet Overview Header */}
      <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            Endpoint Agent Fleet Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time status of distributed log shippers across production Linux & BSD nodes
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className={`p-2 rounded-lg bg-[#060a16] border border-slate-800 text-slate-300 hover:text-white transition self-end md:self-auto ${
            isFetching ? "animate-spin text-cyan-400" : ""
          }`}
          title="Refresh fleet"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Agents Table */}
      <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl shadow-lg backdrop-blur overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Registered Endpoint Forwarders
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Total nodes: <strong className="text-cyan-400">{agentsList?.length ?? 0}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-[#060a16] text-slate-400 border-b border-slate-800/80">
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-3">Agent Name</th>
                <th className="py-2.5 px-3">Hostname</th>
                <th className="py-2.5 px-3">IP Address</th>
                <th className="py-2.5 px-3">Operating System</th>
                <th className="py-2.5 px-3">Last Heartbeat</th>
                <th className="py-2.5 px-4">First Enrolled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                    Querying agent fleet status...
                  </td>
                </tr>
              ) : !agentsList || agentsList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <p>No endpoint agents currently connected.</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Deploy the <code>gm-forwarder.py</code> script below on any server to begin streaming.
                    </p>
                  </td>
                </tr>
              ) : (
                agentsList.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      {getStatusBadge(agent.status, agent.lastSeenAt)}
                    </td>
                    <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                      {agent.name}
                    </td>
                    <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                      {agent.hostname || "-"}
                    </td>
                    <td className="py-3 px-3 text-cyan-400 whitespace-nowrap">
                      {agent.ip || "-"}
                    </td>
                    <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                      {agent.os || "Linux"}
                    </td>
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                      {formatTimeAgo(agent.lastSeenAt)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {formatDate(agent.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forwarder Deployment Assistant */}
      <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur space-y-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Deploy Forwarder Agent (`gm-forwarder.py`)
            </h3>
            <p className="text-xs text-slate-400">
              Zero external dependencies (Python 3 stdlib only). Tail logs and ship alerts in real time.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Agent Identifier Name</label>
            <input
              type="text"
              value={agentNameInput}
              onChange={(e) => setAgentNameInput(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#060a16] border border-slate-800 rounded text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Target Log File</label>
            <input
              type="text"
              value={logPathInput}
              onChange={(e) => setLogPathInput(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#060a16] border border-slate-800 rounded text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* One liner command */}
        <div className="bg-[#060a16] p-3.5 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 font-mono">
              1. Quick Run / Standalone Terminal
            </span>
            <button
              onClick={() => handleCopy(quickRunCmd, "quick")}
              className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition"
            >
              {copiedType === "quick" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedType === "quick" ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="text-xs font-mono text-emerald-300 bg-black/60 p-2.5 rounded border border-slate-900 overflow-x-auto">
            {quickRunCmd}
          </pre>
        </div>

        {/* Systemd unit */}
        <div className="bg-[#060a16] p-3.5 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 font-mono">
              2. Production 24/7 Systemd Service (`/etc/systemd/system/gm-forwarder.service`)
            </span>
            <button
              onClick={() => handleCopy(systemdService, "systemd")}
              className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition"
            >
              {copiedType === "systemd" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedType === "systemd" ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="text-xs font-mono text-cyan-300 bg-black/60 p-2.5 rounded border border-slate-900 overflow-x-auto">
            {systemdService}
          </pre>
        </div>
      </div>
    </div>
  );
};
