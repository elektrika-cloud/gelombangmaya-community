import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { Trash2, AlertTriangle, X, RefreshCw, CheckCircle2 } from "lucide-react";

interface PurgeTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PurgeTelemetryModal({
  isOpen,
  onClose,
  onSuccess,
}: PurgeTelemetryModalProps) {
  const [purgeEvents, setPurgeEvents] = useState<boolean>(true);
  const [purgeAlerts, setPurgeAlerts] = useState<boolean>(true);
  const [resetRuleHits, setResetRuleHits] = useState<boolean>(true);
  const [resetAgents, setResetAgents] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const resetMutation = trpc.siem.resetTelemetry.useMutation({
    onSuccess: () => {
      setStatusMsg("Telemetri dan amaran berjaya dipadam!");
      utils.siem.overview.invalidate();
      utils.siem.listEvents.invalidate();
      utils.siem.listAlerts.invalidate();
      utils.siem.listRules.invalidate();
      utils.siem.listAgents.invalidate();
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setStatusMsg(null);
        onClose();
      }, 1200);
    },
  });

  if (!isOpen) return null;

  const handlePurge = () => {
    resetMutation.mutate({
      purgeEvents,
      purgeAlerts,
      resetRuleHits,
      resetAgents,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0b1329] border border-rose-500/40 rounded-2xl shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-rose-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Trash2 className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Padam / Reset Telemetri SIEM
              </h3>
              <p className="text-xs text-rose-300/80 font-mono">
                Purge All Security Events & Alerts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
            <p className="leading-relaxed">
              Tindakan ini akan memadam rekod log acara dan insiden serangan yang telah direkodkan. Sesuai digunakan untuk mengosongkan papan pemuka selepas selesai ujian pentesting atau simulasi.
            </p>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3 bg-[#060a16] p-4 rounded-xl border border-slate-800 text-sm">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={purgeEvents}
                onChange={(e) => setPurgeEvents(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500"
              />
              <span className="text-slate-200">
                Padam Semua Log Acara (<code className="text-cyan-400 text-xs font-mono">events</code>)
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={purgeAlerts}
                onChange={(e) => setPurgeAlerts(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500"
              />
              <span className="text-slate-200">
                Padam Semua Amaran Serangan (<code className="text-rose-400 text-xs font-mono">alerts</code>)
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={resetRuleHits}
                onChange={(e) => setResetRuleHits(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500"
              />
              <span className="text-slate-200">
                Set Semula Kaunter Rule Hits ke 0 (<code className="text-emerald-400 text-xs font-mono">rules.hits = 0</code>)
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none border-t border-slate-800/80 pt-2">
              <input
                type="checkbox"
                checked={resetAgents}
                onChange={(e) => setResetAgents(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500"
              />
              <span className="text-slate-400 text-xs">
                Kosongkan Senarai Endpoint Ejen Terdaftar (<code className="text-slate-400 font-mono">agents</code>)
              </span>
            </label>
          </div>

          {statusMsg && (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              <span>{statusMsg}</span>
            </div>
          )}

          {resetMutation.isError && (
            <div className="text-xs font-semibold text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
              Ralat memadam data: {resetMutation.error.message}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-[#060a16]/50">
          <button
            type="button"
            onClick={onClose}
            disabled={resetMutation.isPending}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handlePurge}
            disabled={resetMutation.isPending || (!purgeEvents && !purgeAlerts && !resetRuleHits && !resetAgents)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-lg shadow-rose-600/30 transition disabled:opacity-50"
          >
            {resetMutation.isPending ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Memadam...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sahkan Padam / Reset Data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
