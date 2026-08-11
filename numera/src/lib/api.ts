/**
 * Client-side helpers for calling Netlify Functions under /api.
 * Each user-facing call attaches the current Supabase access token so the
 * function can verify identity server-side before touching the database
 * with the service-role key.
 */
import { supabase } from "./supabase";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function request<T = any>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = "POST", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) Object.assign(headers, await authHeaders());

  // Browsers reject/strip a body on GET requests, so for GET we serialize
  // the payload into the query string instead of the request body.
  let url = `/api/${path}`;
  let fetchBody: string | undefined;
  if (method === "GET" || method === "HEAD") {
    if (body && typeof body === "object") {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
        if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }
  } else {
    fetchBody = body !== undefined ? JSON.stringify(body) : undefined;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: fetchBody,
  });

  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    const message =
      data?.message || data?.error || `Request failed (${res.status})`;
    if (res.status === 401 || res.status === 403) {
      throw new ApiError(message, res.status);
    }
    throw new ApiError(message, res.status);
  }
  return data as T;
}

/* ── Number Panel (proxied server-side) ───────────────────────── */
export const npApi = {
  services: () => request("np-services", { method: "GET" }),
  countries: (service: string) =>
    request("np-countries", { method: "GET", body: { service } }),
  requestNumber: (service: string, country: string) =>
    request("np-request-number", { body: { service, country } }),
  checkOtp: (requestId: number | string) =>
    request("np-check-otp", { body: { requestId } }),
  releaseNumber: (requestId: number | string) =>
    request("np-release-number", { body: { requestId } }),
  mailGenerate: (username?: string) =>
    request("np-mail-generate", { body: { username } }),
  mailMessages: (address: string) =>
    request("np-mail-messages", { method: "GET", body: { address } }),
};

/* ── Public site settings ─────────────────────────────────────── */
export const settingsApi = {
  public: () => request("public-settings", { method: "GET", auth: false }),
};

/* ── Admin ────────────────────────────────────────────────────── */
export const adminApi = {
  stats: () => request("admin-stats", { method: "GET" }),
  users: (q?: string) =>
    request("admin-users", { method: "GET", body: { q } }),
  userDetail: (id: string) =>
    request("admin-user-detail", { method: "GET", body: { id } }),
  adjustCredit: (userId: string, amount: number, type: "credit" | "debit") =>
    request("admin-user-action", { body: { action: "adjust_credit", userId, amount, type } }),
  toggleStatus: (userId: string, newStatus: "active" | "blocked") =>
    request("admin-user-action", { body: { action: "toggle_status", userId, newStatus } }),
  payments: (status: string) =>
    request("admin-payments", { method: "GET", body: { status } }),
  reviewPayment: (id: number, decision: "approve" | "reject", reply?: string) =>
    request("admin-review-payment", { body: { id, decision, reply } }),
  saveSettings: (settings: Record<string, string>) =>
    request("admin-settings", { body: { action: "save_settings", settings } }),
  savePaymentDetails: (details: Record<string, string>) =>
    request("admin-settings", { body: { action: "save_payment", details } }),
  saveBranding: (logoUrl: string) =>
    request("admin-settings", { body: { action: "save_branding", logoUrl } }),
  saveServicePrice: (service: string, price: number) =>
    request("admin-service-prices", { body: { action: "save", service, price } }),
  deleteServicePrice: (service: string) =>
    request("admin-service-prices", { body: { action: "delete", service } }),
};
