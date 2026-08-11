import { adminClient, json, error, getPublicSettings } from "./_lib/shared.js";

/** GET /api/public-settings — non-secret site config (site name, pricing, payment details, logo). */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  try {
    const client = adminClient();
    const settings = await getPublicSettings(client);
    return json({ settings });
  } catch (e) {
    return error(e.message || "Could not load settings.", 500);
  }
}
