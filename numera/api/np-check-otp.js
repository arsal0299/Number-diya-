import {
  adminClient, json, error, body, NP, requireUser, withVercel} from "./_lib/shared.js";

/**
 * POST /api/np-check-otp  { requestId }
 * Polls the provider for an OTP for a pending number. If found, the held amount
 * is finalized (charged) and a transaction is logged. If the hold expired, the
 * number is released and the hold refunded.
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
    if (row.status !== "pending") return json({ otp: row.otp_code });

    // Expired? release + refund.
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
      await NP.releaseNumber(client, row.number).catch(() => {});
      await client.rpc("release_hold", { p_user_id: profile.id, p_amount: row.hold_amount });
      await client.from("number_requests").update({ status: "expired", released_at: new Date().toISOString() }).eq("id", row.id);
      return json({ expired: true });
    }

    const otpResp = await NP.latestOtp(client, row.number);
    if (otpResp.has_otp && otpResp.otp_code) {
      const { error: finErr } = await client.rpc("finalize_hold", {
        p_user_id: profile.id,
        p_amount: row.hold_amount,
        p_description: `Number verified: ${row.service}/${row.country}`,
      });
      if (finErr) return error("Could not finalize charge.", 500);
      await client
        .from("number_requests")
        .update({ otp_code: otpResp.otp_code, otp_received_at: new Date().toISOString(), status: "active" })
        .eq("id", row.id);
      return json({ otp: otpResp.otp_code });
    }

    return json({ otp: null });
  } catch (e) {
    return error(e.message || "Could not check OTP.", 500);
  }
}

export default withVercel(handler);
