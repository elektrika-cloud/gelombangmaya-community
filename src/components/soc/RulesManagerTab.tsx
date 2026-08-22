import React, { useState } from "react";
import { trpc } from "../../lib/trpc";
import {
  ShieldCheck,
  Plus,
  Trash2,
  RefreshCw,
  X,
  Zap,
} from "lucide-react";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;
type RuleSeverity = (typeof SEVERITIES)[number];
type RuleKind = "match" | "threshold" | "ioc";
type MatchField = "message" | "srcIp" | "user" | "source" | "action";
type GroupByField = "srcIp" | "user";

type ParsedRuleConfig = {
  kind?: string;
  field?: string;
  pattern?: string;
  action?: string;
  count?: number;
  windowSec?: number;
  groupBy?: string;
  matchOn?: string[];
};

export const RulesManagerTab: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSeverity, setNewSeverity] = useState<RuleSeverity>("high");
  const [newKind, setNewKind] = useState<RuleKind>("match");

  // Specific rule configuration fields
  const [matchField, setMatchField] = useState<MatchField>("message");
  const [matchPattern, setMatchPattern] = useState("");

  const [threshAction, setThreshAction] = useState("auth_failure");
  const [threshCount, setThreshCount] = useState(5);
  const [threshWindow, setThreshWindow] = useState(300);
  const [threshGroupBy, setThreshGroupBy] = useState<GroupByField>("srcIp");

  const { data: rulesList, isLoading, refetch, isFetching } = trpc.siem.listRules.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const toggleMutation = trpc.siem.toggleRule.useMutation({
    onSuccess: () => refetch(),
  });

  const deleteMutation = trpc.siem.deleteRule.useMutation({
    onSuccess: () => refetch(),
  });

  const seedMutation = trpc.siem.seedDefaultRules.useMutation({
    onSuccess: () => refetch(),
  });

  const createRuleMutation = trpc.siem.createRule.useMutation({
    onSuccess: () => {
      setShowCreateModal(false);
      resetForm();
      refetch();
    },
  });

  const resetForm = () => {
    setNewCode("");
    setNewName("");
    setNewDesc("");
    setNewSeverity("high");
    setNewKind("match");
    setMatchPattern("");
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    let configObj: Record<string, unknown> = {};

    if (newKind === "match") {
      configObj = { kind: "match", field: matchField, pattern: matchPattern };
    } else if (newKind === "threshold") {
      configObj = {
        kind: "threshold",
        action: threshAction,
        count: Number(threshCount),
        windowSec: Number(threshWindow),
        groupBy: threshGroupBy,
      };
    } else if (newKind === "ioc") {
      configObj = { kind: "ioc", matchOn: ["srcIp", "message"] };
    }

    createRuleMutation.mutate({
      code: newCode.trim().toUpperCase(),
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      severity: newSeverity,
      kind: newKind,
      config: JSON.stringify(configObj),
    });
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
      {/* Top Header / Actions Bar */}
      <div className="bg-[#0b1329]/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Detection Heuristics & Rules Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time pattern matching, behavioral thresholds, and threat intel IOC lookups
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(!rulesList || rulesList.length === 0) && (
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded-lg transition"
            >
              Seed Default Ruleset (GM-0001 - GM-0008)
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition shadow glow-emerald flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Rule
          </button>
          <button
            onClick={() => refetch()}
            className={`p-2 rounded-lg bg-[#060a16] border border-slate-800 text-slate-300 hover:text-white transition ${
              isFetching ? "animate-spin text-emerald-400" : ""
            }`}
            title="Refresh rules"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-2 py-12 text-center text-slate-500 font-mono">
            Loading detection rules...
          </div>
        ) : !rulesList || rulesList.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-slate-500 font-mono bg-[#0b1329]/80 border border-slate-800 rounded-xl">
            <p>No detection rules configured.</p>
            <button
              onClick={() => seedMutation.mutate()}
              className="mt-3 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
            >
              Load Default GelombangMaya Rules
            </button>
          </div>
        ) : (
          rulesList.map((rule) => {
            let parsedCfg: ParsedRuleConfig | null = null;
            try {
              parsedCfg = JSON.parse(rule.config) as ParsedRuleConfig;
            } catch {
              // Ignore invalid JSON config in rule
            }

            return (
              <div
                key={rule.id}
                className={`bg-[#0b1329]/90 border rounded-xl p-4 shadow-lg backdrop-blur transition ${
                  rule.enabled ? "border-slate-800 hover:border-slate-700" : "border-slate-800/40 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {rule.code}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getSeverityBadgeClass(
                        rule.severity,
                      )}`}
                    >
                      {rule.severity}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {rule.kind}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Toggle switch */}
                    <button
                      onClick={() =>
                        toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })
                      }
                      className={`px-2 py-0.5 text-[10px] font-bold rounded border transition ${
                        rule.enabled
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                      }`}
                    >
                      {rule.enabled ? "ACTIVE" : "DISABLED"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete rule ${rule.code}?`)) {
                          deleteMutation.mutate({ id: rule.id });
                        }
                      }}
                      className="p-1 text-slate-500 hover:text-rose-400 transition"
                      title="Delete rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-white text-sm mb-1">{rule.name}</h3>
                {rule.description && (
                  <p className="text-xs text-slate-400 mb-3">{rule.description}</p>
                )}

                {/* Config Snippet */}
                {parsedCfg && (
                  <div className="bg-[#060a16] p-2 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-300 space-y-1">
                    {rule.kind === "match" && (
                      <div>
                        <span className="text-slate-500">Pattern ({parsedCfg.field}): </span>
                        <code className="text-emerald-300 bg-black/40 px-1 py-0.5 rounded">
                          {parsedCfg.pattern}
                        </code>
                      </div>
                    )}
                    {rule.kind === "threshold" && (
                      <div>
                        <span className="text-slate-500">Threshold: </span>
                        <span className="text-orange-300 font-bold">{parsedCfg.count}x </span>
                        <span className="text-slate-400">"{parsedCfg.action}" </span>
                        <span className="text-slate-500">per </span>
                        <span className="text-cyan-300">{parsedCfg.groupBy} </span>
                        <span className="text-slate-500">in {parsedCfg.windowSec}s</span>
                      </div>
                    )}
                    {rule.kind === "ioc" && (
                      <div>
                        <span className="text-slate-500">IOC Target: </span>
                        <span className="text-cyan-300">
                          {parsedCfg.matchOn?.join(", ") || "srcIp, message"}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Triggered Hits:
                  </span>
                  <span className="font-bold text-emerald-400">{rule.hits}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0b1329] border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Create Custom Detection Heuristic
            </h3>

            <form onSubmit={handleCreateRule} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Rule Code</label>
                  <input
                    type="text"
                    required
                    placeholder="GM-0009"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full px-3 py-2 bg-[#060a16] border border-slate-800 rounded font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Severity</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as RuleSeverity)}
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
                <label className="block text-slate-400 font-mono mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Reverse Shell Spawned"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#060a16] border border-slate-800 rounded text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Detects bash/sh interactive socket connections"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-[#060a16] border border-slate-800 rounded text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Detection Kind</label>
                <select
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value as RuleKind)}
                  className="w-full px-3 py-2 bg-[#060a16] border border-slate-800 rounded font-mono text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="match">Pattern Match (Regex / Substring)</option>
                  <option value="threshold">Threshold (Behavioral Velocity)</option>
                  <option value="ioc">Threat Intel IOC Correlation</option>
                </select>
              </div>

              {/* Kind Specific Fields */}
              {newKind === "match" && (
                <div className="space-y-2 bg-[#060a16] p-3 rounded border border-slate-800">
                  <div>
                    <label className="block text-slate-400 font-mono mb-1">Target Field</label>
                    <select
                      value={matchField}
                      onChange={(e) => setMatchField(e.target.value as MatchField)}
                      className="w-full px-3 py-1.5 bg-black/40 border border-slate-800 rounded font-mono text-white"
                    >
                      <option value="message">message (Raw log body)</option>
                      <option value="srcIp">srcIp (Source IP address)</option>
                      <option value="user">user (Account identity)</option>
                      <option value="source">source (Daemon / service name)</option>
                      <option value="action">action (Event action type)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-mono mb-1">
                      Regex Pattern (case-insensitive)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="(nc -e|/bin/sh|base64 -d)"
                      value={matchPattern}
                      onChange={(e) => setMatchPattern(e.target.value)}
                      className="w-full px-3 py-1.5 bg-black/40 border border-slate-800 rounded font-mono text-emerald-300"
                    />
                  </div>
                </div>
              )}

              {newKind === "threshold" && (
                <div className="space-y-2 bg-[#060a16] p-3 rounded border border-slate-800">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-mono mb-1">Action Name</label>
                      <input
                        type="text"
                        required
                        value={threshAction}
                        onChange={(e) => setThreshAction(e.target.value)}
                        className="w-full px-3 py-1.5 bg-black/40 border border-slate-800 rounded font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-mono mb-1">Group By</label>
                      <select
                        value={threshGroupBy}
                        onChange={(e) => setThreshGroupBy(e.target.value as GroupByField)}
                        className="w-full px-3 py-1.5 bg-black/40 border border-slate-800 rounded font-mono text-white"
                      >
                        <option value="srcIp">srcIp</option>
                        <option value="user">user</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-mono mb-1">Count Trigger</label>
                      <input
                        type="number"
                        min={1}
                        value={threshCount}
                        onChange={(e) => setThreshCount(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-black/40 border border-slate-800 rounded font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-mono mb-1">
                        Window (seconds)
                      </label>
                      <input
                        type="number"
                        min={10}
                        value={threshWindow}
                        onChange={(e) => setThreshWindow(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-black/40 border border-slate-800 rounded font-mono text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {newKind === "ioc" && (
                <div className="bg-[#060a16] p-3 rounded border border-slate-800 text-slate-400">
                  Matches automatically against all active IOCs in the Threat Intel repository on{" "}
                  <code className="text-cyan-300">srcIp</code> and <code className="text-cyan-300">message</code>.
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRuleMutation.isPending}
                  className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow glow-emerald transition"
                >
                  {createRuleMutation.isPending ? "Creating..." : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
