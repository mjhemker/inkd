/**
 * Data access: aftercare healing check-ins + the healed-photo → portfolio loop.
 *
 * Check-in rows are created by the DB trigger on session completion; the app
 * reads them, the client responds to their own, and the artist (with the
 * client's explicit consent) mirrors a healed photo into their public
 * portfolio. RLS scopes every read/write to the client + owning artist
 * (supabase/migrations/20260717090000_aftercare.sql).
 *
 * Healed photos live in the PRIVATE `aftercare-photos` bucket
 * (`<client_id>/<checkin_id>/<file>`). They only ever become public when the
 * artist runs `shareHealedPhotoToPortfolio`, which uploads a FRESH copy into the
 * public `media` bucket and inserts a portfolio piece — that insert flows
 * through the existing AI-tagging enqueue trigger like any other portfolio
 * image (we never touch tagging here).
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type {
  AftercareCheckin,
  AftercareCheckinUpdate,
  PortfolioPiece,
} from "../types/rows";
import {
  buildResponsePatch,
  canShareHealedPhoto,
  type AftercareResponseInput,
} from "../aftercare/consent";
import { aftercareTattooLabel } from "../aftercare/schedule";
import { unwrap, unwrapList, unwrapMaybe } from "./helpers";
import { uploadMedia } from "./media";
import { createPortfolioPiece } from "./content";

export const AFTERCARE_PHOTOS_BUCKET = "aftercare-photos";

// ===========================================================================
// Reads
// ===========================================================================

/** All check-ins for a booking, oldest-scheduled first (artist healing view). */
export async function listBookingAftercareCheckins(
  client: InkdSupabaseClient,
  bookingId: string,
): Promise<AftercareCheckin[]> {
  return unwrapList(
    await client
      .from("aftercare_checkins")
      .select("*")
      .eq("booking_id", bookingId)
      .order("scheduled_for", { ascending: true }),
  );
}

/** All check-ins for a session (multi-session bookings each get their own set). */
export async function listSessionAftercareCheckins(
  client: InkdSupabaseClient,
  sessionId: string,
): Promise<AftercareCheckin[]> {
  return unwrapList(
    await client
      .from("aftercare_checkins")
      .select("*")
      .eq("session_id", sessionId)
      .order("scheduled_for", { ascending: true }),
  );
}

/** The client's own healing timeline across bookings (newest scheduled first). */
export async function listClientAftercareCheckins(
  client: InkdSupabaseClient,
  clientId: string,
): Promise<AftercareCheckin[]> {
  return unwrapList(
    await client
      .from("aftercare_checkins")
      .select("*")
      .eq("client_id", clientId)
      .order("scheduled_for", { ascending: false }),
  );
}

export async function getAftercareCheckin(
  client: InkdSupabaseClient,
  id: string,
): Promise<AftercareCheckin | null> {
  return unwrapMaybe(
    await client.from("aftercare_checkins").select("*").eq("id", id).maybeSingle(),
  );
}

/** A check-in plus the light context the client screen needs to render warm,
 * grounded copy (the piece's label + the artist's display name). */
export interface AftercareCheckinContext {
  checkin: AftercareCheckin;
  tattooLabel: string;
  artistDisplayName: string | null;
}

export async function getAftercareCheckinContext(
  client: InkdSupabaseClient,
  id: string,
): Promise<AftercareCheckinContext | null> {
  const checkin = await getAftercareCheckin(client, id);
  if (!checkin) return null;

  let bookingTitle: string | null = null;
  let serviceName: string | null = null;
  if (checkin.booking_id) {
    const { data } = await client
      .from("bookings")
      .select("title, services(name)")
      .eq("id", checkin.booking_id)
      .maybeSingle();
    if (data) {
      bookingTitle = (data as { title: string | null }).title ?? null;
      const svc = (data as { services: unknown }).services;
      const s = Array.isArray(svc) ? svc[0] : svc;
      serviceName = s && typeof s === "object" ? ((s as { name?: string }).name ?? null) : null;
    }
  }

  let artistDisplayName: string | null = null;
  const { data: artist } = await client
    .from("artist_profiles")
    .select("profiles(display_name)")
    .eq("id", checkin.artist_id)
    .maybeSingle();
  if (artist) {
    const prof = (artist as { profiles: unknown }).profiles;
    const p = Array.isArray(prof) ? prof[0] : prof;
    artistDisplayName =
      p && typeof p === "object" ? ((p as { display_name?: string }).display_name ?? null) : null;
  }

  return {
    checkin,
    tattooLabel: aftercareTattooLabel({ bookingTitle, serviceName }),
    artistDisplayName,
  };
}

// ===========================================================================
// Client: respond to a check-in
// ===========================================================================

/**
 * The client submits their healing response (rating, note, optional photo,
 * consent). Consent is clamped to false when no photo is attached
 * (`buildResponsePatch`). The DB `notify_artist_on_aftercare_response` trigger
 * fires the artist notification. `now` is injectable for tests.
 */
export async function respondToAftercareCheckin(
  client: InkdSupabaseClient,
  id: string,
  input: AftercareResponseInput,
  now: Date = new Date(),
): Promise<AftercareCheckin> {
  const patch = buildResponsePatch(input, now) as AftercareCheckinUpdate;
  return unwrap(
    await client.from("aftercare_checkins").update(patch).eq("id", id).select("*").single(),
  );
}

// ===========================================================================
// Client: photo upload into the private aftercare-photos bucket
// ===========================================================================

type UploadBody = Blob | ArrayBuffer | ArrayBufferView;

function safeName(name: string): string {
  const cleaned = name.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_");
  return cleaned.slice(-120) || "photo";
}

export interface UploadAftercarePhotoArgs {
  clientId: string;
  checkinId: string;
  file: UploadBody;
  filename: string;
  contentType?: string;
}

/** Upload a healed photo; returns the private storage path to persist on the
 * check-in via `respondToAftercareCheckin({ photo_path })`. */
export async function uploadAftercarePhoto(
  client: InkdSupabaseClient,
  args: UploadAftercarePhotoArgs,
): Promise<string> {
  const path = `${args.clientId}/${args.checkinId}/${Date.now()}_${safeName(args.filename)}`;
  const { error } = await client.storage
    .from(AFTERCARE_PHOTOS_BUCKET)
    .upload(path, args.file, { contentType: args.contentType, upsert: false });
  if (error) throw error;
  return path;
}

/** Signed, time-limited URL for a private aftercare photo (client + linked
 * artist only, per RLS). Returns null if the caller can't read it. */
export async function getAftercarePhotoUrl(
  client: InkdSupabaseClient,
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(AFTERCARE_PHOTOS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// ===========================================================================
// Artist: healed-photo → portfolio (the consent loop)
// ===========================================================================

const shareSchema = z.object({
  title: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  placement: z.string().trim().max(120).nullable().optional(),
  style_tags: z.array(z.string()).optional(),
});

export interface ShareHealedPhotoArgs {
  /** The responded check-in with a consented photo (guarded by state machine). */
  checkin: AftercareCheckin;
  /** `artist_profiles.id` → the portfolio piece's owner. */
  artistProfileId: string;
  /** `profiles.id` (auth uid) → the `media` bucket path prefix. */
  artistUserId: string;
  meta?: z.input<typeof shareSchema>;
}

export interface ShareHealedPhotoResult {
  portfolioPiece: PortfolioPiece;
  checkin: AftercareCheckin;
}

/**
 * With the client's consent, mirror a private healed photo into the artist's
 * PUBLIC portfolio: copy the bytes into the `media` bucket, insert a
 * portfolio_piece (attributed, marked healed, linked back via the check-in),
 * and stamp `shared_as_portfolio_piece_id`. The portfolio insert auto-enqueues
 * AI tagging via the existing DB trigger.
 *
 * Throws if the check-in is not in a shareable state (no photo / no consent /
 * already shared) — the same guard the UI uses to gate the button.
 */
export async function shareHealedPhotoToPortfolio(
  client: InkdSupabaseClient,
  args: ShareHealedPhotoArgs,
): Promise<ShareHealedPhotoResult> {
  const { checkin } = args;
  if (!canShareHealedPhoto(checkin)) {
    throw new Error(
      "This healed photo can't be shared: it needs the client's consent and an attached photo, and must not already be shared.",
    );
  }
  if (!checkin.photo_path) {
    throw new Error("No healed photo on this check-in.");
  }
  const meta = shareSchema.parse(args.meta ?? {});

  // 1. Read the private photo (RLS: linked artist may read).
  const signedUrl = await getAftercarePhotoUrl(client, checkin.photo_path, 120);
  if (!signedUrl) throw new Error("Couldn't access the healed photo.");
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`Couldn't download the healed photo (${res.status}).`);
  const blob = await res.blob();
  const contentType = blob.type || "image/jpeg";
  const ext = contentType.includes("/") ? contentType.split("/")[1] : "jpg";

  // 2. Upload a FRESH copy into the public media bucket under the artist prefix.
  const uploaded = await uploadMedia(client, args.artistUserId, "portfolio", {
    data: blob,
    name: `healed-${checkin.id}.${ext}`,
    contentType,
  });

  // 3. Insert the portfolio piece (triggers AI-tag enqueue automatically).
  const portfolioPiece = await createPortfolioPiece(client, args.artistProfileId, {
    image_url: uploaded.publicUrl,
    title: meta.title ?? null,
    description: meta.description ?? null,
    placement: meta.placement ?? null,
    style_tags: meta.style_tags ?? [],
    is_healed: true,
    is_public: true,
  });

  // 4. Link the check-in to the shared piece.
  const updated = unwrap(
    await client
      .from("aftercare_checkins")
      .update({ shared_as_portfolio_piece_id: portfolioPiece.id } as AftercareCheckinUpdate)
      .eq("id", checkin.id)
      .select("*")
      .single(),
  );

  return { portfolioPiece, checkin: updated };
}
