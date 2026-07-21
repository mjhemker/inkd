// GET|POST /functions/v1/instagram-status   (verify_jwt = true)
//
// Artist-scoped connection status for the settings + onboarding UI. Clients
// cannot read instagram_connections directly (RLS: no policies, by design — it
// holds tokens), so this endpoint reads the caller's row with the service role
// and returns EXACTLY { connected, ig_username, connected_at, last_synced_at,
// token_expired } — NEVER a token field.
//
// Design notes:
//   - 404-free: a not-connected artist gets 200 { connected: false, ... }.
//   - No 503 gate: status reads only the DB, so it works regardless of whether
//     the Instagram app secrets are configured (unlike the OAuth/media endpoints).
import {
  handlePreflight,
  requireUser,
  getAdminClient,
  resolveArtistId,
  jsonResponse,
  errorResponse,
  errors,
} from "../_shared/ig-common.ts";
import { shapeStatusResponse } from "../_shared/ig-status.ts";

Deno.serve(async (req) => {
  const pf = handlePreflight(req);
  if (pf) return pf;
  try {
    const user = await requireUser(req);
    const admin = getAdminClient();
    const artistId = await resolveArtistId(admin, user.id);

    const { data, error } = await admin
      .from("instagram_connections")
      .select("ig_username, connected_at, last_synced_at, token_expires_at")
      .eq("artist_id", artistId)
      .maybeSingle();
    if (error) throw errors.server(error.message);

    return jsonResponse(shapeStatusResponse(data ?? null, Date.now()));
  } catch (err) {
    if (!(err && (err as { name?: string }).name === "AppError")) console.error("instagram-status:", err);
    return errorResponse(err);
  }
});
