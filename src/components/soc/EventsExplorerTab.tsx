import React, { useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatDate } from "../../lib/utils";
import {
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Terminal,
  FileJson,
  Layers,
} from "lucide-react";
import { ContainmentModal } from "./ContainmentModal";

const LEVELS = ["debug", "info", "notice", "warning", "error", "critical"] as const;
type EventLevel = (typeof LEVELS)[number];

export const EventsExplorerTab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<EventLevel | "">("");
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [selectedIpForContainment, setSelectedIpForContainment] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = trpc.siem.listEvents.useQuery(
    {
      q: searchTerm.trim() || undefined,
      level: selectedLevel || undefined,
      source: selectedSource.trim() || undefined,
      action: selectedAction.trim() || undefined,
      limit,
      offset,
    },
    { refetchInterval: 5000 },
  );

  const getLevelBadgeClass = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/40";
      case "error":
        return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      case "warning":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "notice":
        return "bg-sky-500/20 text-sky-400 border-sky-500/30";
      case "info":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "debug":
        return "bg-slate-800 text-slate-400 border-slate-700";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    refetch();
  };

  const totalPages = Math.ceil((data?.total ?? 0) / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search raw log message, IP, or user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#060a16] border border-slate-800 rounded-lg text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Level Selector */}
            <select
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value as EventLevel | "");
                setOffset(0);
              }}
              className="bg-[#060a16] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Severity Levels</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>

            {/* Source Input */}
            <input
              type="text"
              placeholder="Source (e.g. sshd, nginx)"
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value);
                setOffset(0);
              }}
              className="bg-[#060a16] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 md:w-44"
            />

            {/* Action Input */}
            <input
              type="text"
              placeholder="Action (e.g. auth_failure)"
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setOffset(0);
              }}
              className="bg-[#060a16] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 md:w-44"
            />

            {/* Submit & Refresh */}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition shadow glow-emerald flex items-center gap-1.5"
              >
                <Filter className="w-3.5 h-3.5" />
                Query
              </button>
              <button
                type="button"
                onClick={() => refetch()}
                className={`p-2 rounded-lg bg-[#060a16] border border-slate-800 text-slate-300 hover:text-white transition ${
                  isFetching ? "animate-spin text-emerald-400" : ""
                }`}
                title="Refresh logs"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Events Table */}
      <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl shadow-lg backdrop-blur overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Live Event Telemetry Log Stream
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Total records: <strong className="text-emerald-400">{data?.total ?? 0}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-[#060a16] text-slate-400 border-b border-slate-800/80">
                <th className="py-2.5 px-3 w-8"></th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Level</th>
                <th className="py-2.5 px-3">Source</th>
                <th className="py-2.5 px-3">Host / Agent</th>
                <th className="py-2.5 px-3">Source IP</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-4">Message</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-mono">
                    Querying SIEM telemetry events...
                  </td>
                </tr>
              ) : !data?.rows || data.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    <p>No telemetry events matched the current filter.</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Run the <code>scripts/gm-forwarder.py</code> agent on your servers to ship events.
                    </p>
                  </td>
                </tr>
              ) : (
                data.rows.map(({ event: ev, agentName }) => {
                  const isExpanded = expandedRowId === ev.id;
                  let parsedMeta: Record<string, unknown> | null = null;
                  if (ev.metadata) {
                    try {
                      parsedMeta = JSON.parse(ev.metadata) as Record<string, unknown>;
                    } catch {
                      // Metadata was not valid JSON
                    }
                  }

                  return (
                    <React.Fragment key={ev.id}>
                      <tr
                        className={`hover:bg-slate-800/40 transition cursor-pointer ${
                          isExpanded ? "bg-slate-800/50" : ""
                        }`}
                        onClick={() => setExpandedRowId(isExpanded ? null : ev.id)}
                      >
                        <td className="py-2 px-3 text-slate-500 text-center">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                          {formatDate(ev.eventAt)}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getLevelBadgeClass(
                              ev.level,
                            )}`}
                          >
                            {ev.level}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-200 whitespace-nowrap">
                          {ev.source}
                        </td>
                        <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                          {agentName || `agent#${ev.agentId}`}
                        </td>
                        <td className="py-2 px-3 text-cyan-400 whitespace-nowrap">
                          {ev.srcIp || "-"}
                        </td>
                        <td className="py-2 px-3 text-orange-300 whitespace-nowrap">
                          {ev.action || "-"}
                        </td>
                        <td className="py-2 px-4 text-slate-300 max-w-md truncate font-sans">
                          {ev.message}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          {ev.srcIp && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedIpForContainment(ev.srcIp);
                              }}
                              className="px-2 py-0.5 text-[10px] rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition"
                            >
                              Block IP
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expandable JSON Detail */}
                      {isExpanded && (
                        <tr className="bg-[#050812]">
                          <td colSpan={9} className="p-4 border-t border-slate-800/80">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                                  Raw Event Payload #{ev.id}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  User: <strong className="text-slate-300">{ev.user || "none"}</strong> |
                                  Destination IP:{" "}
                                  <strong className="text-slate-300">{ev.dstIp || "none"}</strong>
                                </span>
                              </div>

                              <div className="p-3 bg-black/60 rounded border border-slate-800 text-xs font-mono text-emerald-300 whitespace-pre-wrap break-all">
                                {ev.message}
                              </div>

                              {parsedMeta && (
                                <div>
                                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                                    <FileJson className="w-3 h-3 text-cyan-400" />
                                    Metadata Object
                                  </span>
                                  <pre className="p-2.5 bg-black/40 rounded border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto">
                                    {JSON.stringify(parsedMeta, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setOffset(0);
              }}
              className="bg-[#060a16] border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400">
              Page <strong>{currentPage}</strong> of <strong>{Math.max(totalPages, 1)}</strong>
            </span>
            <div className="flex gap-1">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(offset - limit, 0))}
                className="px-2.5 py-1 rounded bg-[#060a16] border border-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition"
              >
                Previous
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setOffset(offset + limit)}
                className="px-2.5 py-1 rounded bg-[#060a16] border border-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition"
              >
                Next
              </button>
            </div>
          </div>
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
