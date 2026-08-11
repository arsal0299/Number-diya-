import { adminClient, json, error, NP, getSetting } from "./_lib/shared.js";

/** GET /api/np-services — list available services. Public-ish (no wallet needed). */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  try {
    const client = adminClient();
    const resp = await NP.services(client);
    return json({ services: resp.services || [] });
  } catch (e) {
    return error(e.message || "Failed to load services.", 502);
  }
}
