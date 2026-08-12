import { adminClient, json, error, body, requireAdmin, withVercel} from "./_lib/shared.js";

/**
 * POST /api/admin-settings
 *   { action: "save_settings", settings: {...} }
 *   { action: "save_payment",  details: {...} }
 *   { action: "save_branding", logoUrl }
 * Writes key/value rows into the settings table (upsert).
 */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  const { response } = await requireAdmin(event);
  if (response) return response;

  try {
    const c = adminClient();
    const { action, settings, details, logoUrl } = body(event);

    const upsert = async (obj) => {
      const rows = Object.entries(obj).map(([key, value]) => ({ key, value: String(value) }));
      if (!rows.length) return;
      const { error: e } = await c.from("settings").upsert(rows, { onConflict: "key" });
      if (e) throw e;
    };

    if (action === "save_settings") {
      const allowed = ["site_name", "np_api_key", "np_base_url", "price_per_number", "number_hold_minutes", "country_status", "contact_email", "min_topup_amount"];
      const clean = {};
      allowed.forEach((k) => { if (k in settings) clean[k] = settings[k]; });
      await upsert(clean);
      return json({ success: true });
    }
    if (action === "save_payment") {
      const allowed = ["payment_method_name", "payment_bank_name", "payment_account_title", "payment_account_number", "payment_instructions"];
      const clean = {};
      allowed.forEach((k) => { if (k in details) clean[k] = details[k]; });
      await upsert(clean);
      return json({ success: true });
    }
    if (action === "save_branding") {
      await upsert({ site_logo_url: logoUrl });
      return json({ success: true });
    }
    return error("Unknown action.", 400);
  } catch (e) {
    return error(e.message || "Could not save settings.", 500);
  }
}

export default withVercel(handler);
