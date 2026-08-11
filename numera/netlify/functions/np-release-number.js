import { adminClient, json, error, body, NP, requireUser } from "./_lib/shared.js";

/**
 * POST /api/np-release-number  { requestId }
 * Releases a pending/active number back to the provider. Pending holds are
 * refunded in full; active numbers (already charged) are just released.
 */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  const { profile, response } = await requireUser(event);
  if (response) return response;

  try {
    const { requestId } = body(event);
    if (!requestId) return error("Missing request id.", 400);

    const client = adminClient();
    const { data: row } = await client
      .from("number_requests")
      .select("*")
      .eq("id", requestId)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (!row) return error("Number request not found.", 404);
    if (row.status !== "pending" && row.status !== "active") return json({ success: true });

    await NP.releaseNumber(client, row.number).catch(() => {});

    if (row.status === "pending") {
      await client.rpc("release_hold", { p_user_id: profile.id, p_amount: row.hold_amount });
    }
    await client
      .from("number_requests")
      .update({ status: "released", released_at: new Date().toISOString() })
      .eq("id", row.id);

    return json({ success: true });
  } catch (e) {
    return error(e.message || "Could not release number.", 500);
  }
}
