import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { History as HistoryIcon, ArrowDownLeft, ArrowUpRight, Smartphone } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { rs, formatDateTime } from "../../lib/utils";
import type { Transaction, NumberRequest } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";

export function History() {
  const [tx, setTx] = useState<Transaction[]>([]);
  const [numbers, setNumbers] = useState<NumberRequest[]>([]);

  useEffect(() => {
    (async () => {
      const [t, n] = await Promise.all([
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("number_requests").select("*").order("requested_at", { ascending: false }).limit(50),
      ]);
      setTx((t.data as Transaction[]) || []);
      setNumbers((n.data as NumberRequest[]) || []);
    })();
  }, []);

  return (
    <div>
      <PageHeader title="History" subtitle="Your wallet transactions and past number requests." />

      <h2 className="font-display font-bold text-xl mb-4" style={{ color: "var(--fg)" }}>Wallet history</h2>
      <div className="card overflow-hidden mb-9">
        {tx.length === 0 ? (
          <EmptyState icon={<HistoryIcon className="w-6 h-6 text-brand-400" />} title="No transactions yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--fg-dim)" }} className="text-left">
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Date</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Type</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Amount</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Description</th>
                </tr>
              </thead>
              <tbody>
                {tx.map((t, i) => (
                  <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-5 py-3.5" style={{ color: "var(--fg-muted)" }}>{formatDateTime(t.created_at)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`badge badge-${t.type === "credit" ? "active" : "released"}`}>
                        {t.type === "credit" ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {t.type}
                      </span>
                    </td>
                    <td className={`px-5 py-3.5 font-mono font-semibold ${t.type === "credit" ? "text-brand-400" : ""}`} style={t.type === "debit" ? { color: "var(--fg)" } : undefined}>
                      {t.type === "credit" ? "+" : "−"}{rs(t.amount)}
                    </td>
                    <td className="px-5 py-3.5 max-w-[320px]" style={{ color: "var(--fg-muted)" }}>{t.description || "—"}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h2 className="font-display font-bold text-xl mb-4" style={{ color: "var(--fg)" }}>Number requests</h2>
      <div className="card overflow-hidden">
        {numbers.length === 0 ? (
          <EmptyState icon={<Smartphone className="w-6 h-6 text-brand-400" />} title="No number requests yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--fg-dim)" }} className="text-left">
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Number</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Service</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Country</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">OTP</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Status</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Requested</th>
                </tr>
              </thead>
              <tbody>
                {numbers.map((n, i) => (
                  <motion.tr key={n.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-5 py-3.5 font-mono" style={{ color: "var(--fg)" }}>{n.number}</td>
                    <td className="px-5 py-3.5" style={{ color: "var(--fg-muted)" }}>{n.service}</td>
                    <td className="px-5 py-3.5" style={{ color: "var(--fg-muted)" }}>{n.country}</td>
                    <td className="px-5 py-3.5 font-mono text-brand-400">{n.otp_code || "—"}</td>
                    <td className="px-5 py-3.5"><span className={`badge badge-${n.status}`}>{n.status}</span></td>
                    <td className="px-5 py-3.5" style={{ color: "var(--fg-muted)" }}>{formatDateTime(n.requested_at)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
