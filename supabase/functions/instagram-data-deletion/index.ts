// POST /functions/v1/instagram-data-deletion   (verify_jwt = false)
//
// Meta's Data Deletion Request callback. Same `signed_request` handling as the
// deauthorize callback. We verify the signature, extract user_id, and delete the
// artist's instagram_connections rows (their imported posts stay — that content
// lives in the artist's own INKD account and is their own work). Returns Meta's
// required shape: { url, confirmation_code }, always HTTP 200.
//
// Docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
import {
  igConfig,
  optionalEnv,
  getAdminClient,
  jsonResponse,
  parseSignedRequest,
} from "../_shared/ig-common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true });

  const appBase = optionalEnv("PUBLIC_APP_URL", "https://getinkd.co");
  const confirmationCode = `ig-del-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const statusUrl = `${appBase.replace(/\/$/, "")}/legal/data-deletion?code=${confirmationCode}`;

  try {
    const signed = await readSignedRequest(req);
    const cfg = igConfig();

    // Best-effort deletion; ALWAYS return Meta's required shape with 200.
    if (cfg && signed) {
      const payload = await parseSignedRequest(signed, cfg.appSecret);
      const userId = payload?.user_id ? String(payload.user_id) : "";
      if (userId) {
        const admin = getAdminClient();
        await admin.from("instagram_connections").delete().eq("ig_user_id", userId);
      }
    }

    return jsonResponse({ url: statusUrl, confirmation_code: confirmationCode }, 200);
  } catch (err) {
    console.error("instagram-data-deletion:", err instanceof Error ? err.message : "error");
    // Still return the required shape so Meta can present a status page.
    return jsonResponse({ url: statusUrl, confirmation_code: confirmationCode }, 200);
  }
});

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
