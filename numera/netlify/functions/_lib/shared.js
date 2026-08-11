/**
 * Shared helpers for Netlify Functions.
 * Uses the Supabase service-role key (server-only) so we can bypass RLS for
 * privileged operations while still verifying the caller's identity via their
 * access token. The numberpanel API key is read from env, falling back to the
 * value stored in the `settings` table.
 */
import { createClient } from "@supabase/supabase-js";

export function cors(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

export function json(body, status = 200, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", ...cors(), ...extraHeaders },
    body: JSON.stringify(body),
  };
}

export function error(message, status = 400) {
  return json({ message }, status);
}

/** Build a service-role Supabase client from env. */
export function adminClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Server not configured: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Verify the Bearer token sent by the SPA and return the matching profile row.
 * Throws (returns null) when there's no valid session.
 */
export async function getUserProfile(event) {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);

  const client = adminClient();
  const { data, error: e } = await client.auth.getUser(token);
  if (e || !data.user) return null;

  const { data: profile } = await client
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();
  return profile;
}

export async function requireUser(event) {
  const profile = await getUserProfile(event);
  if (!profile) return { profile: null, response: error("Authentication required.", 401) };
  if (profile.status === "blocked")
    return { profile: null, response: error("Your account has been blocked.", 403) };
  return { profile, response: null };
}

export async function requireAdmin(event) {
  const { profile, response } = await requireUser(event);
  if (response) return { profile: null, response };
  if (!profile.is_admin) return { profile: null, response: error("Admin access required.", 403) };
  return { profile, response: null };
}

export function body(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString() : event.body);
  } catch {
    return {};
  }
}

/* ── Settings helper ──────────────────────────────────────────── */
const PUBLIC_KEYS = [
  "site_name", "price_per_number", "min_topup_amount", "number_hold_minutes",
  "country_status", "contact_email", "site_logo_url",
  "payment_method_name", "payment_bank_name", "payment_account_title",
  "payment_account_number", "payment_instructions",
];
export const PUBLIC_SETTING_KEYS = PUBLIC_KEYS;

export async function getSetting(client, key, fallback = "") {
  const { data } = await client.from("settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? fallback;
}

export async function getAllSettings(client) {
  const { data } = await client.from("settings").select("key,value");
  const map = {};
  (data || []).forEach((r) => (map[r.key] = r.value));
  return map;
}

export async function getPublicSettings(client) {
  const all = await getAllSettings(client);
  const out = {};
  PUBLIC_KEYS.forEach((k) => (out[k] = all[k] ?? ""));
  return out;
}

/* ── Number Panel API ─────────────────────────────────────────── */
async function npCall(client, method, endpoint, params = {}) {
  const baseUrl = (process.env.NP_BASE_URL || (await getSetting(client, "np_base_url", "https://numberpanel.tech"))).replace(/\/$/, "");
  const apiKey = process.env.NP_API_KEY || (await getSetting(client, "np_api_key", ""));
  if (!apiKey) throw new Error("Provider API key not configured. Set it in Admin → Settings.");

  const url = baseUrl + endpoint;
  const opt = {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    timeout: 20000,
  };
  if (method === "GET" && Object.keys(params).length) {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${url}?${q}`, opt);
    return res.json();
  }
  if (method !== "GET") opt.body = JSON.stringify(params);
  const res = await fetch(url, opt);
  return res.json();
}

export const NP = {
  services: (c) => npCall(c, "GET", "/api/services"),
  countries: (c, service) => npCall(c, "GET", "/api/countries", { service }),
  requestNumber: (c, service, country) => npCall(c, "POST", "/api/request_number", { service, country }),
  releaseNumber: (c, number) => npCall(c, "POST", "/api/release_number", { number }),
  latestOtp: (c, number) => npCall(c, "GET", "/api/latest_otp", { number }),
  mailGenerate: (c, username) => npCall(c, "POST", "/api/mail/generate", username ? { username } : {}),
  mailMessages: (c, address) => npCall(c, "GET", "/api/mail/messages", { address }),
};

/* ── Pricing ──────────────────────────────────────────────────── */
export async function servicePrice(client, service) {
  const { data } = await client.from("service_prices").select("price").eq("service", service).maybeSingle();
  return data ? Number(data.price) : Number(await getSetting(client, "price_per_number", "5.00"));
}
