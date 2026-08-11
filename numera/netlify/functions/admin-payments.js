import { adminClient, json, error, body, requireAdmin } from "./_lib/shared.js";

/** GET /api/admin-payments  { status } — payment requests by status. */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  const { response } = await requireAdmin(event);
  if (response) return response;

  try {
    const c = adminClient();
    const { status } = body(event);
    let q = c
      .from("payment_requests")
      .select("*, profiles!inner(username,email)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (status && status !== "all") q = q.eq("status", status);
    const { data, error: e } = await q;
    if (e) return error(e.message, 500);

    const out = (data || []).map((p) => ({
      id: p.id,
      username: p.profiles?.username,
      email: p.profiles?.email,
      amount: p.amount,
      screenshot_url: p.screenshot_url,
      status: p.status,
      admin_reply: p.admin_reply,
      created_at: p.created_at,
    }));
    return json({ payments: out });
  } catch (e) {
    return error(e.message || "Could not load payments.", 500);
  }
}
