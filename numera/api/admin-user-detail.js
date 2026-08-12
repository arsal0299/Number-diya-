import { adminClient, json, error, body, requireAdmin, withVercel} from "./_lib/shared.js";

/** GET /api/admin-user-detail  { id } — full profile + activity for one user. */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  const { response } = await requireAdmin(event);
  if (response) return response;

  try {
    const c = adminClient();
    const { id } = body(event);
    if (!id) return error("User id required.", 400);

    const { data: user } = await c.from("profiles").select("*").eq("id", id).maybeSingle();
    if (!user) return error("User not found.", 404);

    const [tx, numbers, payments] = await Promise.all([
      c.from("transactions").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
      c.from("number_requests").select("*").eq("user_id", id).order("requested_at", { ascending: false }).limit(50),
      c.from("payment_requests").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    ]);

    return json({
      user,
      transactions: tx.data || [],
      numbers: numbers.data || [],
      payments: payments.data || [],
    });
  } catch (e) {
    return error(e.message || "Could not load user.", 500);
  }
}

export default withVercel(handler);
