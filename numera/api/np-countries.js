import { adminClient, json, error, body, NP, requireUser, withVercel} from "./_lib/shared.js";

/** GET /api/np-countries — countries for a service. Requires login. */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  const { response } = await requireUser(event);
  if (response) return response;
  try {
    const { service } = body(event);
    if (!service) return error("Service is required.", 400);
    const client = adminClient();
    const resp = await NP.countries(client, service);
    return json({ countries: resp.countries || [] });
  } catch (e) {
    return error(e.message || "Failed to load countries.", 502);
  }
}

export default withVercel(handler);
