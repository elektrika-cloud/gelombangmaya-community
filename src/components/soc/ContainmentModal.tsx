import React, { useState } from "react";
import { ShieldAlert, Copy, Check, Terminal, X } from "lucide-react";

interface ContainmentModalProps {
  ip: string | null;
  onClose: () => void;
}

export const ContainmentModal: React.FC<ContainmentModalProps> = ({ ip, onClose }) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!ip) return null;

  const commands = [
    {
      name: "iptables (Linux Kernel Firewall)",
      cmd: `sudo iptables -I INPUT -s ${ip} -j DROP\nsudo iptables -I FORWARD -s ${ip} -j DROP\n# Save rules:\nsudo iptables-save | sudo tee /etc/iptables/rules.v4`,
    },
    {
      name: "UFW (Uncomplicated Firewall)",
      cmd: `sudo ufw insert 1 deny from ${ip} to any comment "GelombangMaya Threat Isolation"`,
    },
    {
      name: "nftables",
      cmd: `sudo nft add rule inet filter input ip saddr ${ip} drop`,
    },
    {
      name: "AWS CLI (Network ACL Deny)",
      cmd: `aws ec2 create-network-acl-entry --network-acl-id <YOUR_NACL_ID> --rule-number 100 --protocol -1 --rule-action deny --egress false --cidr-block ${ip}/32`,
    },
  ];

  const handleCopy = (cmd: string, type: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b1329] border border-rose-500/40 rounded-xl max-w-2xl w-full p-6 shadow-2xl glow-rose relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Automated Containment: <span className="font-mono text-rose-400">{ip}</span>
            </h3>
            <p className="text-xs text-slate-400">
              One-click instant host isolation & firewall drop commands
            </p>
          </div>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {commands.map((c) => (
            <div key={c.name} className="bg-[#060a16] border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  {c.name}
                </span>
                <button
                  onClick={() => handleCopy(c.cmd, c.name)}
                  className="text-xs flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                >
                  {copiedType === c.name ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-xs font-mono bg-black/60 p-2.5 rounded border border-slate-900 text-emerald-300 overflow-x-auto selection:bg-rose-500/30">
                {c.cmd}
              </pre>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-3 pt-3 border-t border-slate-800/80">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
