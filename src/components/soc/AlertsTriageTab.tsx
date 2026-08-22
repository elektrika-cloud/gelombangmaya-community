import React, { useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatDate } from "../../lib/utils";
import {
  CheckCircle2,
  ShieldAlert,
  RefreshCw,
  Eye,
  Check,
  FileSpreadsheet,
} from "lucide-react";
import { ContainmentModal } from "./ContainmentModal";

type AlertStatus = "open" | "acknowledged" | "resolved" | "false_positive";
const SEVERITIES = ["critical", "high", "medium", "low"] as const;
type AlertSeverity = (typeof SEVERITIES)[number];

export const AlertsTriageTab: React.FC = () => {
  const [selectedStatus, setSelectedStatus] = useState<AlertStatus | "">("open");
  const [selectedSeverity, setSelectedSeverity] = useState<AlertSeverity | "">("");
  const [selectedIpForContainment, setSelectedIpForContainment] = useState<string | null>(null);

  const { data: alertsList, isLoading, refetch, isFetching } = trpc.siem.listAlerts.useQuery(
    {
      status: selectedStatus || undefined,
      severity: selectedSeverity || undefined,
      limit: 100,
    },
    { refetchInterval: 5000 },
  );

  const updateStatusMutation = trpc.siem.updateAlertStatus.useMutation({
    onSuccess: () => refetch(),
  });

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/40 glow-rose";
      case "high":
        return "bg-orange-500/20 text-orange-400 border-orange-500/40";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/40";
      case "low":
        return "bg-slate-800 text-slate-300 border-slate-700";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "open":
        return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      case "acknowledged":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "resolved":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "false_positive":
        return "bg-slate-800 text-slate-400 border-slate-700";
      default:
        return "bg-slate-800 text-slate-300";
    }
  };

  const handleExportCSV = () => {
    if (!alertsList || alertsList.length === 0) return;
    const headers = ["ID", "Title", "Severity", "Status", "Rule Code", "Agent", "Source IP", "Event Count", "Created At"];
    const rows = alertsList.map((a) => [
      a.alert.id,
      `"${a.alert.title.replace(/"/g, '""')}"`,
      a.alert.severity,
      a.alert.status,
      a.ruleCode || "-",
      a.agentName || "-",
      a.alert.srcIp || "-",
      a.alert.eventCount,
      a.alert.createdAt,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `gelombangmaya-alerts-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Filter and Action Bar */}
      <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#060a16] p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setSelectedStatus("open")}
              className={`px-3 py-1 rounded transition ${
                selectedStatus === "open"
                  ? "bg-rose-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Open Queue
            </button>
            <button
              onClick={() => setSelectedStatus("acknowledged")}
              className={`px-3 py-1 rounded transition ${
                selectedStatus === "acknowledged"
                  ? "bg-amber-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Acknowledged
            </button>
            <button
              onClick={() => setSelectedStatus("resolved")}
              className={`px-3 py-1 rounded transition ${
                selectedStatus === "resolved"
                  ? "bg-emerald-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Resolved
            </button>
            <button
              onClick={() => setSelectedStatus("")}
              className={`px-3 py-1 rounded transition ${
                selectedStatus === ""
                  ? "bg-slate-700 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All Statuses
            </button>
          </div>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value as AlertSeverity | "")}
            className="bg-[#060a16] border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={!alertsList || alertsList.length === 0}
            className="px-3 py-1.5 bg-[#060a16] hover:bg-slate-800 text-slate-200 border border-slate-800 disabled:opacity-40 text-xs font-mono rounded-lg transition flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Export CSV
          </button>
          <button
            onClick={() => refetch()}
            className={`p-2 rounded-lg bg-[#060a16] border border-slate-800 text-slate-300 hover:text-white transition ${
              isFetching ? "animate-spin text-emerald-400" : ""
            }`}
            title="Refresh alerts"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl shadow-lg backdrop-blur overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Active Incident Response Queue
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Total incidents: <strong className="text-rose-400">{alertsList?.length ?? 0}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-[#060a16] text-slate-400 border-b border-slate-800/80">
                <th className="py-2.5 px-4">Severity</th>
                <th className="py-2.5 px-3">Rule / ID</th>
                <th className="py-2.5 px-4">Incident Title</th>
                <th className="py-2.5 px-3">Source IP</th>
                <th className="py-2.5 px-3">Affected Host</th>
                <th className="py-2.5 px-3">Hits</th>
                <th className="py-2.5 px-3">Triggered</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-4 text-right">Triage Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-mono">
                    Loading security alerts...
                  </td>
                </tr>
              ) : !alertsList || alertsList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-mono">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
                    <p className="text-slate-300 font-semibold">No alerts in this triage queue</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Threat detection engine is actively monitoring incoming telemetry.
                    </p>
                  </td>
                </tr>
              ) : (
                alertsList.map(({ alert, ruleCode, agentName }) => (
                  <tr key={alert.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${getSeverityBadgeClass(
                          alert.severity,
                        )}`}
                      >
                        {alert.severity}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-emerald-400 font-semibold whitespace-nowrap">
                      {ruleCode || `RULE#${alert.ruleId}`}
                    </td>
                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-bold text-white text-xs">{alert.title}</div>
                      {alert.detail && (
                        <div className="text-[11px] text-slate-400 truncate mt-0.5 font-sans">
                          {alert.detail}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-cyan-400 whitespace-nowrap">
                      {alert.srcIp ? (
                        <div className="flex items-center gap-1.5">
                          <span>{alert.srcIp}</span>
                          <button
                            onClick={() => setSelectedIpForContainment(alert.srcIp)}
                            className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition"
                            title="Generate firewall block rules"
                          >
                            <ShieldAlert className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                      {agentName || (alert.agentId ? `agent#${alert.agentId}` : "Global")}
                    </td>
                    <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">
                        {alert.eventCount}x
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                      {formatDate(alert.createdAt)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadgeClass(
                          alert.status,
                        )}`}
                      >
                        {alert.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {alert.status === "open" && (
                          <button
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: alert.id,
                                status: "acknowledged",
                              })
                            }
                            className="px-2 py-1 text-[10px] rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            Ack
                          </button>
                        )}
                        {alert.status !== "resolved" && (
                          <button
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: alert.id,
                                status: "resolved",
                              })
                            }
                            className="px-2 py-1 text-[10px] rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Resolve
                          </button>
                        )}
                        {alert.status !== "false_positive" && (
                          <button
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: alert.id,
                                status: "false_positive",
                              })
                            }
                            className="px-2 py-1 text-[10px] rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition"
                            title="Mark as False Positive"
                          >
                            FP
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
