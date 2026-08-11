import { adminClient, json, error, body, requireAdmin } from "./_lib/shared.js";

/** GET /api/admin-users  { q? } — list/search users with aggregated stats. */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  const { response } = await requireAdmin(event);
  if (response) return response;

  try {
    const c = adminClient();
    const { q } = body(event);
    let query = c.from("profiles").select("*");
    if (q) {
      query = query.or(`username.ilike.%${q}%,email.ilike.%${q}%`);
    }
    query = query.order("created_at", { ascending: false }).limit(200);
    const { data: users, error: e } = await query;
    if (e) return error(e.message, 500);

    // Aggregate counts per user
    const ids = (users || []).map((u) => u.id);
    let numCount = {}, otpCount = {}, spent = {};
    if (ids.length) {
      const [{ data: nAll }, { data: tAll }] = await Promise.all([
        c.from("number_requests").select("user_id,status").in("user_id", ids),
        c.from("transactions").select("user_id,type,amount").in("user_id", ids).eq("type", "debit"),
      ]);
      (nAll || []).forEach((n) => {
        numCount[n.user_id] = (numCount[n.user_id] || 0) + 1;
        if (n.status === "active") otpCount[n.user_id] = (otpCount[n.user_id] || 0) + 1;
      });
      (tAll || []).forEach((t) => {
        spent[t.user_id] = (spent[t.user_id] || 0) + Number(t.amount || 0);
      });
    }

    const out = (users || []).map((u) => ({
      ...u,
      total_numbers: numCount[u.id] || 0,
      otp_count: otpCount[u.id] || 0,
      total_spent: spent[u.id] || 0,
    }));

    return json({ users: out });
  } catch (e) {
    return error(e.message || "Could not load users.", 500);
  }
}
