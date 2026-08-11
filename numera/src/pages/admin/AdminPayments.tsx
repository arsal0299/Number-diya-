import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, X, ExternalLink, Loader2 } from "lucide-react";
import { adminApi } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { rs, formatDateTime } from "../../lib/utils";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";

interface Row {
  id: number;
  username: string;
  email: string;
  amount: number;
  screenshot_url: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
}

const FILTERS = ["pending", "approved", "rejected", "all"] as const;

export function AdminPayments() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<Row | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminApi.payments(filter);
      setRows(r.payments as Row[]);
    } catch {
      toast("Could not load payments.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const review = async (decision: "approve" | "reject") => {
    if (!reviewing) return;
    setBusy(true);
    try {
      await adminApi.reviewPayment(reviewing.id, decision, reply.trim() || undefined);
      toast(`Payment ${decision === "approve" ? "approved" : "rejected"}.`, "success");
      setReviewing(null);
      setReply("");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Payment requests" subtitle="Review top-up proofs, approve or reject with a note." />

      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-outline"}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="No payment requests here" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--fg-dim)" }} className="text-left">
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">User</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Amount</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Proof</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Status</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Submitted</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-5 py-3.5">
                      <div className="font-medium" style={{ color: "var(--fg)" }}>{p.username}</div>
                      <div className="text-xs" style={{ color: "var(--fg-dim)" }}>{p.email}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono font-semibold" style={{ color: "var(--fg)" }}>{rs(p.amount)}</td>
                    <td className="px-5 py-3.5">
                      <a href={p.screenshot_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-400 text-xs hover:underline">
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="px-5 py-3.5"><span className={`badge badge-${p.status === "approved" ? "active" : p.status === "rejected" ? "rejected" : "pending"}`}>{p.status}</span></td>
                    <td className="px-5 py-3.5" style={{ color: "var(--fg-muted)" }}>{formatDateTime(p.created_at)}</td>
                    <td className="px-5 py-3.5">
                      {p.status === "pending" && (
                        <button
                          onClick={() => { setReviewing(p); setReply(p.admin_reply ?? ""); }}
                          className="btn btn-primary btn-sm"
                        >
                          Review
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!reviewing} onClose={() => setReviewing(null)} title={reviewing ? `Review — ${reviewing.username}` : ""}>
        {reviewing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg font-bold text-brand-400">{rs(reviewing.amount)}</span>
              <a href={reviewing.screenshot_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                Open screenshot <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div>
              <label className="label">Note to user (optional)</label>
              <textarea
                rows={3}
                className="input"
                placeholder="e.g. Payment verified — credited to your wallet."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => review("approve")} disabled={busy} className="btn btn-primary flex-1">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve &amp; credit
              </button>
              <button onClick={() => review("reject")} disabled={busy} className="btn btn-danger flex-1">
                <X className="w-4 h-4" /> Reject
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
