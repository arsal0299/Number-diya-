import { adminClient, json, error, requireAdmin } from "./_lib/shared.js";

/** GET /api/admin-stats — platform-wide metrics for the admin dashboard. */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  const { response } = await requireAdmin(event);
  if (response) return response;

  try {
    const c = adminClient();

    const count = async (table, filter) => {
      let q = c.from(table).select("*", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count: n } = await q;
      return n || 0;
    };

    const sum = async (table, column, filter) => {
      let q = c.from(table).select(column);
      if (filter) q = filter(q);
      const { data } = await q;
      return (data || []).reduce((a, r) => a + Number(r[column] || 0), 0);
    };

    const [
      total_users, blocked_users, total_numbers, active_numbers, pending_numbers,
      total_revenue, wallets_total, held_total, pending_payments,
    ] = await Promise.all([
      count("profiles"),
      count("profiles", (q) => q.eq("status", "blocked")),
      count("number_requests"),
      count("number_requests", (q) => q.eq("status", "active")),
      count("number_requests", (q) => q.eq("status", "pending")),
      sum("transactions", "amount", (q) => q.eq("type", "debit")),
      sum("profiles", "wallet_balance"),
      sum("profiles", "wallet_hold"),
      count("payment_requests", (q) => q.eq("status", "pending")),
    ]);

    const { data: recent } = await c
      .from("number_requests")
      .select("*, profiles!inner(username)")
      .order("requested_at", { ascending: false })
      .limit(10);

    const recentMapped = (recent || []).map((r) => ({
      ...r,
      username: r.profiles?.username,
      profiles: undefined,
    }));

    return json({
      stats: {
        total_users, blocked_users, total_numbers, active_numbers, pending_numbers,
        total_revenue, wallets_total, held_total, pending_payments,
        recent: recentMapped,
      },
    });
  } catch (e) {
    return error(e.message || "Could not load stats.", 500);
  }
}
