import { adminClient, json, error, NP, requireUser } from "./_lib/shared.js";

/**
 * GET /api/live-otp-feed — global feed of recently-received OTPs across
 * all users (login required, no per-user filter — mirrors public OTP
 * marketplaces where numbers are shared/temporary), plus a few stat
 * widgets for the page header.
 */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  const { response } = await requireUser(event);
  if (response) return response;

  try {
    const c = adminClient();

    const { data: feed, error: feedErr } = await c
      .from("number_requests")
      .select("number, otp_code, service, country, otp_received_at")
      .not("otp_code", "is", null)
      .order("otp_received_at", { ascending: false })
      .limit(50);
    if (feedErr) return error(feedErr.message, 500);

    // Distinct regions ever seen (grows with real usage).
    const { data: regionRows } = await c.from("number_requests").select("country").not("country", "is", null);
    const regions = new Set((regionRows || []).map((r) => r.country)).size;

    // Supported services from the upstream provider (falls back to 0 on failure).
    let servicesCount = 0;
    try {
      const svc = await NP.services(c);
      servicesCount = (svc.services || []).length;
    } catch {
      /* upstream hiccup — keep 0, not fatal for the page */
    }

    // Top traffic in the last 30 minutes, grouped by service + country.
    const since30 = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recent } = await c
      .from("number_requests")
      .select("service, country")
      .not("otp_code", "is", null)
      .gte("otp_received_at", since30);
    const trafficMap = new Map();
    for (const r of recent || []) {
      const key = `${r.service}|${r.country}`;
      trafficMap.set(key, (trafficMap.get(key) || 0) + 1);
    }
    const totalRecent = recent?.length || 0;
    const topTraffic = [...trafficMap.entries()]
      .map(([key, count]) => {
        const [service, country] = key.split("|");
        return { service, country, percent: totalRecent ? Math.round((count / totalRecent) * 100) : 0 };
      })
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 6);

    // OTP volume for the last 6 hours (hourly buckets) for the bar chart.
    const since6h = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: hourly } = await c
      .from("number_requests")
      .select("otp_received_at")
      .not("otp_code", "is", null)
      .gte("otp_received_at", since6h);
    const buckets = new Array(6).fill(0);
    const now = Date.now();
    for (const r of hourly || []) {
      const ageMs = now - new Date(r.otp_received_at).getTime();
      const idx = 5 - Math.min(5, Math.floor(ageMs / (60 * 60 * 1000)));
      if (idx >= 0 && idx < 6) buckets[idx]++;
    }

    return json({
      feed: (feed || []).map((f) => ({
        number: f.number,
        otp: f.otp_code,
        service: f.service,
        country: f.country,
        time: f.otp_received_at,
      })),
      stats: { regions, services: servicesCount },
      topTraffic,
      hourly: buckets,
    });
  } catch (e) {
    return error(e.message || "Could not load live OTP feed.", 500);
  }
}
