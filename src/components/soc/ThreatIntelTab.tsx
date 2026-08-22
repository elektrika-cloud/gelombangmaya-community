import React, { useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatDate } from "../../lib/utils";
import {
  Globe,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  X,
  Hash,
  Link,
  Server,
  AlertOctagon,
} from "lucide-react";

const IOC_TYPES = ["ip", "domain", "hash", "url"] as const;
type IocType = (typeof IOC_TYPES)[number];
const SEVERITIES = ["critical", "high", "medium", "low"] as const;
type IocSeverity = (typeof SEVERITIES)[number];

export const ThreatIntelTab: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<IocType | "">("");
  const [searchTerm, setSearchTerm] = useState("");

  const [newType, setNewType] = useState<IocType>("ip");
  const [newValue, setNewValue] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSeverity, setNewSeverity] = useState<IocSeverity>("high");

  const { data: iocsList, isLoading, refetch, isFetching } = trpc.siem.listIocs.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const addIocMutation = trpc.siem.addIoc.useMutation({
    onSuccess: () => {
      setShowAddModal(false);
      resetForm();
      refetch();
    },
  });

  const deleteIocMutation = trpc.siem.deleteIoc.useMutation({
    onSuccess: () => refetch(),
  });

  const resetForm = () => {
    setNewType("ip");
    setNewValue("");
    setNewDescription("");
    setNewSeverity("high");
  };

  const handleAddIoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;

    addIocMutation.mutate({
      type: newType,
      value: newValue.trim(),
      description: newDescription.trim() || undefined,
      severity: newSeverity,
    });
  };

  const filteredIocs = (iocsList || []).filter((ioc) => {
    if (selectedTypeFilter && ioc.type !== selectedTypeFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        ioc.value.toLowerCase().includes(q) ||
        (ioc.description && ioc.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "ip":
        return <Server className="w-3.5 h-3.5 text-cyan-400" />;
      case "domain":
        return <Globe className="w-3.5 h-3.5 text-emerald-400" />;
      case "hash":
        return <Hash className="w-3.5 h-3.5 text-amber-400" />;
      case "url":
        return <Link className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <AlertOctagon className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/40";
      case "high":
        return "bg-orange-500/20 text-orange-400 border-orange-500/40";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/40";
      case "low":
        return "bg-slate-800 text-slate-300 border-slate-700";
      default:
        return "bg-slate-800 text-slate-300";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            Threat Intelligence & IOC Blacklist
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time correlation engine matches incoming telemetry against known malicious indicators
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition shadow glow-emerald flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add IOC
          </button>
          <button
            onClick={() => refetch()}
            className={`p-2 rounded-lg bg-[#060a16] border border-slate-800 text-slate-300 hover:text-white transition ${
              isFetching ? "animate-spin text-emerald-400" : ""
            }`}
            title="Refresh IOC list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-3 shadow-lg backdrop-blur flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search indicator value or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-[#060a16] border border-slate-800 rounded-lg text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-[#060a16] p-1 rounded-lg border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setSelectedTypeFilter("")}
            className={`px-2.5 py-1 rounded transition ${
              selectedTypeFilter === "" ? "bg-slate-700 text-white font-bold" : "text-slate-400"
            }`}
          >
            All
          </button>
          {IOC_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTypeFilter(t)}
              className={`px-2.5 py-1 rounded transition uppercase ${
                selectedTypeFilter === t
                  ? "bg-emerald-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* IOC Table */}
      <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl shadow-lg backdrop-blur overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Active Indicators
          </span>
          <span className="text-xs font-mono text-slate-400">
            Total IOCs: <strong className="text-emerald-400">{filteredIocs.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-[#060a16] text-slate-400 border-b border-slate-800/80">
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-4">Indicator Value</th>
                <th className="py-2.5 px-4">Threat Description / Notes</th>
                <th className="py-2.5 px-3">Enrolled</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-mono">
                    Loading threat intelligence database...
                  </td>
                </tr>
              ) : filteredIocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <p>No IOCs match the criteria.</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Add malicious IPs, domains, or hashes to detect C2 communication.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredIocs.map((ioc) => (
                  <tr key={ioc.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1.5 font-bold uppercase text-slate-200">
                        {getTypeIcon(ioc.type)}
                        {ioc.type}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getSeverityBadgeClass(
                          ioc.severity,
                        )}`}
                      >
                        {ioc.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-white max-w-sm break-all select-all">
                      {ioc.value}
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-md font-sans">
                      {ioc.description || "-"}
                    </td>
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                      {formatDate(ioc.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          if (confirm(`Remove IOC indicator ${ioc.value}?`)) {
                            deleteIocMutation.mutate({ id: ioc.id });
                          }
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 transition"
                        title="Delete IOC"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add IOC Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0b1329] border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-emerald-400" />
              Enroll Threat Indicator (IOC)
            </h3>

            <form onSubmit={handleAddIoc} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Indicator Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as IocType)}
                    className="w-full px-3 py-2 bg-[#060a16] border border-slate-800 rounded font-mono text-white focus:outline-none focus:border-emerald-500"
                  >
                    {IOC_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Severity</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as IocSeverity)}
                    className="w-full px-3 py-2 bg-[#060a16] border border-slate-800 rounded font-mono text-white focus:outline-none focus:border-emerald-500"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">
                  Indicator Value ({newType === "ip" ? "e.g. 198.51.100.23" : newType === "domain" ? "e.g. evil-c2.xyz" : newType === "hash" ? "e.g. SHA256 / MD5" : "e.g. http://bad.com/payload"})
                </label>
                <input
                  type="text"
                  required
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full px-3 py-2 bg-[#060a16] border border-slate-800 rounded font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Threat Description / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Cobalt Strike C2 server observed in phishing campaign"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[#060a16] border border-slate-800 rounded text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addIocMutation.isPending}
                  className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow glow-emerald transition"
                >
                  {addIocMutation.isPending ? "Adding..." : "Add Indicator"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
