import { adminClient, json, error, body, requireAdmin } from "./_lib/shared.js";

/**
 * POST /api/admin-review-payment  { id, decision, reply? }
 * Approve (credits wallet via RPC) or reject a payment request with an optional note.
 */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  const { response } = await requireAdmin(event);
  if (response) return response;

  try {
    const c = adminClient();
    const { id, decision, reply } = body(event);
    if (!id) return error("Payment id required.", 400);

    const { data: p } = await c.from("payment_requests").select("*").eq("id", id).eq("status", "pending").maybeSingle();
    if (!p) return error("Payment not found or already reviewed.", 404);

    if (decision === "approve") {
      const note = reply || `Top-up approved (payment #${p.id})`;
      const { error: e } = await c.rpc("approve_payment", { p_payment_id: id, p_reply: note });
      if (e) return error(e.message, 500);
    } else {
      const note = reply || "This payment could not be verified. Please contact support if you believe this is an error.";
      await c.from("payment_requests").update({ status: "rejected", admin_reply: note, reviewed_at: new Date().toISOString() }).eq("id", id);
    }
    return json({ success: true });
  } catch (e) {
    return error(e.message || "Could not review payment.", 500);
  }
}
