/**
 * Aftercare consent + healed-photo share state machine (pure).
 *
 * Consent is EXPLICIT, opt-in, default OFF. A healed photo only ever becomes a
 * public portfolio piece when the client has (a) attached a photo and (b)
 * toggled consent on, AND the artist then runs the share flow. This module is
 * the single source of truth for those transitions; the API layer + both UIs
 * derive gating from it, and it is unit-tested offline.
 */

/** The lifecycle status stored on `aftercare_checkins.status`. */
export type AftercareStatus = "pending" | "sent" | "responded" | "skipped";

/** The minimal shape the state machine reasons over (a row subset). */
export interface AftercareCheckinState {
  status: AftercareStatus;
  photo_path: string | null;
  consent_to_share: boolean;
  shared_as_portfolio_piece_id: string | null;
}

/**
 * The healed-photo share sub-state, derived from a responded check-in:
 *   - "no_photo"      responded but no photo → nothing to share
 *   - "photo_private" photo attached, consent OFF → artist must NOT share
 *   - "share_ready"   photo + consent ON, not yet shared → artist MAY share
 *   - "shared"        already mirrored into a portfolio piece
 *   - "not_responded" client hasn't responded yet (pending/sent/skipped)
 */
export type AftercareShareState =
  | "not_responded"
  | "no_photo"
  | "photo_private"
  | "share_ready"
  | "shared";

export function deriveShareState(c: AftercareCheckinState): AftercareShareState {
  if (c.shared_as_portfolio_piece_id) return "shared";
  if (c.status !== "responded") return "not_responded";
  if (!c.photo_path) return "no_photo";
  return c.consent_to_share ? "share_ready" : "photo_private";
}

/**
 * The ONLY condition under which the artist may add the healed photo to their
 * portfolio: the client responded, attached a photo, consented, and it hasn't
 * been shared yet. The DB additionally enforces RLS (artist owns the row) and
 * the public portfolio insert; this is the app-level guard.
 */
export function canShareHealedPhoto(c: AftercareCheckinState): boolean {
  return deriveShareState(c) === "share_ready";
}

/** True once the photo has been mirrored into a public portfolio piece. */
export function isHealedPhotoShared(c: AftercareCheckinState): boolean {
  return c.shared_as_portfolio_piece_id != null;
}

// ---------------------------------------------------------------------------
// Client response transition.
// ---------------------------------------------------------------------------

export interface AftercareResponseInput {
  healing_rating?: number | null;
  note?: string | null;
  /** Storage path in the private aftercare-photos bucket, if a photo was added. */
  photo_path?: string | null;
  consent_to_share?: boolean;
}

/**
 * Consent to share is meaningless without a photo to share — clamp it to false
 * when no photo is attached, so a stray "consent on, no photo" state can never
 * be persisted (and can never leak into `share_ready`).
 */
export function sanitizeConsent(consent: boolean | undefined, hasPhoto: boolean): boolean {
  return hasPhoto ? Boolean(consent) : false;
}

/** The persisted patch a client response produces (status → responded). */
export interface AftercareResponsePatch {
  status: "responded";
  responded_at: string;
  healing_rating: number | null;
  note: string | null;
  photo_path: string | null;
  consent_to_share: boolean;
}

/**
 * Build the update patch for a client submitting their check-in response. Pure:
 * the caller supplies `now` so it's deterministic under test. Consent is
 * clamped to false when no photo is present.
 */
export function buildResponsePatch(
  input: AftercareResponseInput,
  now: Date,
): AftercareResponsePatch {
  const photoPath = input.photo_path ?? null;
  const rating =
    input.healing_rating == null ? null : clampRating(input.healing_rating);
  return {
    status: "responded",
    responded_at: now.toISOString(),
    healing_rating: rating,
    note: input.note?.trim() ? input.note.trim() : null,
    photo_path: photoPath,
    consent_to_share: sanitizeConsent(input.consent_to_share, photoPath != null),
  };
}

function clampRating(n: number): number {
  const r = Math.round(n);
  if (r < 1) return 1;
  if (r > 5) return 5;
  return r;
}

/**
 * Whether the 3-week check-in should nudge a review — only at week_3, only when
 * the client hasn't already reviewed the booking. Keeps the review-nudge policy
 * in one testable place (used by the edge dispatcher + the artist healing view).
 */
export function shouldNudgeReview(kind: string, hasReviewed: boolean): boolean {
  return kind === "week_3" && !hasReviewed;
}
