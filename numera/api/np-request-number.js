import {
  adminClient, json, error, body, NP, requireUser, servicePrice, getSetting, withVercel} from "./_lib/shared.js";

/**
 * POST /api/np-request-number  { service, country }
 * Requests a number from the provider, then holds the price against the user's
 * wallet (NOT charged yet). Mirrors the original PHP "hold" logic.
 */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  const { profile, response } = await requireUser(event);
  if (response) return response;

  try {
    const { service, country } = body(event);
    if (!service || !country) return error("Choose a service and a country.", 400);

    const client = adminClient();
    const price = await servicePrice(client, service);

    // Verify the user has enough available balance BEFORE calling the provider.
    const available = Number(profile.wallet_balance) - Number(profile.wallet_hold);
    if (available < price) {
      return error("Insufficient balance. Please top up your wallet.", 402);
    }

    // Hold the amount atomically (only succeeds if still affordable).
    const { data: held, error: holdErr } = await client.rpc("hold_wallet", {
      p_user_id: profile.id,
      p_amount: price,
    });
    if (holdErr || !held) {
      return error("Insufficient available balance. Please top up.", 402);
    }

    // Call the provider.
    const resp = await NP.requestNumber(client, service, country);
    if (!resp.success || !resp.number) {
      // Roll back the hold — provider had no number.
      await client.rpc("release_hold", { p_user_id: profile.id, p_amount: price });
      return error(resp.message || "No numbers available right now.", 502);
    }

    const holdMinutes = Number(await getSetting(client, "number_hold_minutes", "20"));
    const expires = new Date(Date.now() + holdMinutes * 60000).toISOString();

    const { data: row } = await client
      .from("number_requests")
      .insert({
        user_id: profile.id,
        service,
        country,
        number: resp.number,
        cost: price,
        hold_amount: price,
        expires_at: expires,
        status: "pending",
      })
      .select("*")
      .single();

    return json({ success: true, number: row });
  } catch (e) {
    return error(e.message || "Could not request a number.", 500);
  }
}

export default withVercel(handler);
