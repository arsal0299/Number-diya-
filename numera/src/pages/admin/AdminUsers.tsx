import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Search, UserPlus, UserMinus, Ban, CheckCircle2, Loader2 } from "lucide-react";
import { adminApi } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { rs, formatDate } from "../../lib/utils";
import type { AdminUser } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";

export function AdminUsers() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminApi.users(q);
      setUsers(r.users as AdminUser[]);
    } catch {
      toast("Could not load users.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const adjust = async (u: AdminUser, type: "credit" | "debit") => {
    const raw = prompt(`Amount to ${type === "credit" ? "add to" : "deduct from"} ${u.username}'s wallet:`);
    if (!raw) return;
    const amount = Number(raw);
    if (!amount || amount <= 0) return toast("Enter a valid amount.", "error");
    setBusyId(u.id);
    try {
      await adminApi.adjustCredit(u.id, amount, type);
      toast(`Wallet ${type === "credit" ? "credited" : "debited"}.`, "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      const next = u.status === "active" ? "blocked" : "active";
      await adminApi.toggleStatus(u.id, next);
      toast(`User ${next}.`, "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader title="Users" subtitle="Add credits, block or unblock accounts, and review activity." />

      <div className="relative max-w-sm mb-5">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--fg-dim)" }} />
        <input className="input pl-10" placeholder="Search username or email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>
        ) : users.length === 0 ? (
          <EmptyState title="No users found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--fg-dim)" }} className="text-left">
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">User</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Wallet</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Held</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Numbers</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Spent</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Status</th>
                  <th className="px-5 py-3 font-semibold uppercase text-xs tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-5 py-3.5">
                      <button onClick={() => navigate(`/admin/users/${u.id}`)} className="font-semibold text-brand-400 hover:underline">{u.username}</button>
                      <div className="text-xs" style={{ color: "var(--fg-dim)" }}>{u.email}</div>
                      <div className="text-[11px]" style={{ color: "var(--fg-dim)" }}>{formatDate(u.created_at)}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono font-semibold" style={{ color: "var(--fg)" }}>{rs(u.wallet_balance)}</td>
                    <td className="px-5 py-3.5 font-mono" style={{ color: "var(--fg-muted)" }}>{rs(u.wallet_hold)}</td>
                    <td className="px-5 py-3.5 font-mono" style={{ color: "var(--fg-muted)" }}>{u.total_numbers} ({u.otp_count} OTP)</td>
                    <td className="px-5 py-3.5 font-mono" style={{ color: "var(--fg-muted)" }}>{rs(u.total_spent)}</td>
                    <td className="px-5 py-3.5"><span className={`badge badge-${u.status === "active" ? "active" : "blocked"}`}>{u.status}</span></td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        <button disabled={busyId === u.id} onClick={() => adjust(u, "credit")} className="btn btn-ghost btn-sm" title="Add credit">
                          <UserPlus className="w-3.5 h-3.5 text-brand-400" /> Add
                        </button>
                        <button disabled={busyId === u.id} onClick={() => adjust(u, "debit")} className="btn btn-ghost btn-sm" title="Deduct">
                          <UserMinus className="w-3.5 h-3.5 text-amber-400" /> Cut
                        </button>
                        <button disabled={busyId === u.id} onClick={() => toggle(u)} className="btn btn-ghost btn-sm" title={u.status === "active" ? "Block" : "Unblock"}>
                          {u.status === "active" ? <Ban className="w-3.5 h-3.5 text-red-400" /> : <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />}
                        </button>
                      </div>
                    </td>
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
