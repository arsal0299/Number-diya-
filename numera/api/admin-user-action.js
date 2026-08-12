import { adminClient, json, error, body, requireAdmin, withVercel} from "./_lib/shared.js";

/**
 * POST /api/admin-user-action
 *   { action: "adjust_credit", userId, amount, type }   credit/debit wallet
 *   { action: "toggle_status", userId, newStatus }      active/blocked
 */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  const { response } = await requireAdmin(event);
  if (response) return response;

  try {
    const c = adminClient();
    const { action, userId, amount, type, newStatus } = body(event);
    if (!userId) return error("User id required.", 400);

    if (action === "adjust_credit") {
      if (!amount || amount <= 0) return error("Enter a valid amount.", 400);
      const t = type === "debit" ? "debit" : "credit";
      const { error: e } = await c.rpc("adjust_wallet", {
        p_user_id: userId,
        p_amount: amount,
        p_type: t,
        p_description: "Manual adjustment by admin",
      });
      if (e) return error(e.message, 500);
      return json({ success: true });
    }

    if (action === "toggle_status") {
      const status = newStatus === "blocked" ? "blocked" : "active";
      const { error: e } = await c.from("profiles").update({ status }).eq("id", userId);
      if (e) return error(e.message, 500);
      return json({ success: true });
    }

    return error("Unknown action.", 400);
  } catch (e) {
    return error(e.message || "Action failed.", 500);
  }
}

export default withVercel(handler);
