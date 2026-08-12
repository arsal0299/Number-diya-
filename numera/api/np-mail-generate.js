import { adminClient, json, error, body, NP, requireUser, withVercel} from "./_lib/shared.js";

/** POST /api/np-mail-generate  { username? } — create a disposable mailbox. */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  const { profile, response } = await requireUser(event);
  if (response) return response;

  try {
    const { username } = body(event);
    const client = adminClient();
    const resp = await NP.mailGenerate(client, username || "");
    if (!resp.success || !resp.mail?.address) {
      return error(resp.message || "Could not generate mailbox.", 502);
    }
    await client.from("mailboxes").insert({
      user_id: profile.id,
      address: resp.mail.address,
      token: resp.mail.token ?? null,
    });
    return json({ mail: resp.mail });
  } catch (e) {
    return error(e.message || "Could not generate mailbox.", 500);
  }
}

export default withVercel(handler);
