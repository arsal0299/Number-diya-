import { adminClient, json, error, body, NP, requireUser } from "./_lib/shared.js";

/** GET /api/np-mail-messages  { address } — fetch messages for a mailbox the user owns. */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  const { profile, response } = await requireUser(event);
  if (response) return response;

  try {
    const { address } = body(event);
    if (!address) return error("Address is required.", 400);

    const client = adminClient();
    const { data: owned } = await client
      .from("mailboxes")
      .select("id")
      .eq("user_id", profile.id)
      .eq("address", address)
      .maybeSingle();
    if (!owned) return error("Mailbox not found.", 404);

    const resp = await NP.mailMessages(client, address);
    return json({ messages: resp.messages || [] });
  } catch (e) {
    return error(e.message || "Could not load messages.", 500);
  }
}
