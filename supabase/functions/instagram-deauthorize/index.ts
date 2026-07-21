// POST /functions/v1/instagram-deauthorize   (verify_jwt = false)
//
// Meta's Deauthorize callback. Meta POSTs a `signed_request` (form-encoded or
// JSON) when a user removes the INKD app from their Instagram account. We verify
// the HMAC-SHA256 signature with the app secret, extract the user_id, and delete
// the matching instagram_connections rows. Always returns HTTP 200 with a valid
// JSON shape (Meta requires a 200).
//
// Docs: https://developers.facebook.com/docs/instagram-platform/reference (deauthorize callback)
import {
  igConfig,
  getAdminClient,
  jsonResponse,
  parseSignedRequest,
} from "../_shared/ig-common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true });
  try {
    const signed = await readSignedRequest(req);
    const cfg = igConfig();

    if (!cfg) return jsonResponse({ success: false, reason: "instagram_not_configured" }, 200);
    if (!signed) return jsonResponse({ success: false, reason: "missing_signed_request" }, 200);

    const payload = await parseSignedRequest(signed, cfg.appSecret);
    if (!payload) return jsonResponse({ success: false, reason: "invalid_signature" }, 200);

    const userId = payload.user_id ? String(payload.user_id) : "";
    if (!userId) return jsonResponse({ success: false, reason: "no_user_id" }, 200);

    const admin = getAdminClient();
    const { error } = await admin.from("instagram_connections").delete().eq("ig_user_id", userId);
    if (error) return jsonResponse({ success: false, reason: "delete_failed" }, 200);

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    console.error("instagram-deauthorize:", err instanceof Error ? err.message : "error");
    return jsonResponse({ success: false, reason: "server_error" }, 200);
  }
});

/** Meta may send signed_request as form-urlencoded or JSON. */
async function readSignedRequest(req: Request): Promise<string | null> {
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const j = await req.json();
      return typeof j?.signed_request === "string" ? j.signed_request : null;
    }
    const form = await req.formData();
    const v = form.get("signed_request");
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}
