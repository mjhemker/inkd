// POST /functions/v1/instagram-disconnect   (verify_jwt = true)
//
// Deletes the caller's instagram_connections row (service role, scoped to the
// artist resolved from the JWT). The artist's imported posts + portfolio_pieces
// STAY — that is their own content. Idempotent: disconnecting with no row still
// returns 200 { ok: true, disconnected: true }.
import {
  handlePreflight,
  requireUser,
  getAdminClient,
  resolveArtistId,
  jsonResponse,
  errorResponse,
  errors,
} from "../_shared/ig-common.ts";
import { DISCONNECT_RESPONSE } from "../_shared/ig-status.ts";

Deno.serve(async (req) => {
  const pf = handlePreflight(req);
  if (pf) return pf;
  try {
    if (req.method !== "POST") throw errors.badRequest("Use POST");

    const user = await requireUser(req);
    const admin = getAdminClient();
    const artistId = await resolveArtistId(admin, user.id);

    const { error } = await admin
      .from("instagram_connections")
      .delete()
      .eq("artist_id", artistId);
    if (error) throw errors.server(error.message);

    return jsonResponse(DISCONNECT_RESPONSE);
  } catch (err) {
    if (!(err && (err as { name?: string }).name === "AppError")) console.error("instagram-disconnect:", err);
    return errorResponse(err);
  }
});
