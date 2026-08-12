import { json, error, body, requireUser, withVercel} from "./_lib/shared.js";

const API_URL = "https://eliteprotech-apis.zone.id/ephoto";
const ALLOWED_TYPES = new Set(["effectclouds", "galaxywallpaper", "cartoonstyle", "writetext"]);

/** POST /api/banner-generate  { type, text } — generate a text-effect banner image. Free, no wallet charge. */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({});
  const { response } = await requireUser(event);
  if (response) return response;

  const { type, text } = body(event);
  const cleanText = String(text || "").trim().replace(/\s+/g, " ");
  if (!cleanText) return error("Please enter some text.", 400);
  if (cleanText.length > 60) return error("Text is too long (max 60 characters).", 400);
  const cleanType = ALLOWED_TYPES.has(type) ? type : "cartoonstyle";

  try {
    const requestUrl = `${API_URL}?type=${encodeURIComponent(cleanType)}&text=${encodeURIComponent(cleanText)}`;
    const resp = await fetch(requestUrl, { headers: { Accept: "application/json, image/*" } });
    if (!resp.ok) return error(`Banner service returned an error (HTTP ${resp.status}).`, 502);

    const contentType = resp.headers.get("content-type") || "";
    if (contentType.startsWith("image/")) {
      const buf = Buffer.from(await resp.arrayBuffer());
      const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`;
      return json({ url: dataUrl });
    }

    const data = await resp.json();
    const url = data.result || data.url || data.image || data?.data?.url || (typeof data === "string" ? data : null);
    if (!url) return error("Banner service did not return an image.", 502);
    return json({ url });
  } catch (e) {
    return error(e.message || "Could not generate banner.", 500);
  }
}

export default withVercel(handler);
