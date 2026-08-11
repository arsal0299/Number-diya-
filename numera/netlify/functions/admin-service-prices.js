import { adminClient, json, error, body, requireAdmin } from "./_lib/shared.js";

/**
 * POST /api/admin-service-prices
 *   { action: "save",   service, price }
 *   { action: "delete", service }
 */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  const { response } = await requireAdmin(event);
  if (response) return response;

  try {
    const c = adminClient();
    const { action, service, price } = body(event);
    if (!service) return error("Service required.", 400);

    if (action === "save") {
      if (price == null || price < 0) return error("Enter a valid price.", 400);
      const { error: e } = await c.from("service_prices").upsert({ service, price: Number(price) }, { onConflict: "service" });
      if (e) return error(e.message, 500);
      return json({ success: true });
    }
    if (action === "delete") {
      await c.from("service_prices").delete().eq("service", service);
      return json({ success: true });
    }
    return error("Unknown action.", 400);
  } catch (e) {
    return error(e.message || "Could not update pricing.", 500);
  }
}
