/**
 * Data access: reviews — client-authored ratings on completed bookings, with
 * an optional single artist response (SPEC §4). One review per booking is
 * enforced by the DB's partial unique index on `booking_id`; RLS scopes
 * inserts to the client author and updates to either party (client edits
 * body/rating, artist edits `artist_response`) per
 * `supabase/migrations/20260715001054_content_and_social.sql`.
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type { Profile, Review, ReviewInsert, ReviewUpdate } from "../types/rows";
import { unwrap, unwrapList, unwrapMaybe, clampLimit } from "./helpers";

/** All reviews visible to the caller for a given artist — RLS already scopes
 * this to public reviews for anyone, plus the artist's own (any visibility)
 * and a reviewing client's own. Newest first. */
export async function listArtistReviews(
  client: InkdSupabaseClient,
  artistId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<Review[]> {
  const offset = opts.offset ?? 0;
  return unwrapList(
    await client
      .from("reviews")
      .select("*")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false })
      .range(offset, offset + clampLimit(opts.limit, 100) - 1),
  );
}

/** Reviews the current client has authored (their own "my reviews" list). */
export async function listClientReviews(
  client: InkdSupabaseClient,
  clientId: string,
): Promise<Review[]> {
  return unwrapList(
    await client
      .from("reviews")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  );
}

/** The review already left on a booking, if any — drives the "leave a
 * review" vs. "you already reviewed this" affordance on booking detail. */
export async function getReviewByBookingId(
  client: InkdSupabaseClient,
  bookingId: string,
): Promise<Review | null> {
  return unwrapMaybe(
    await client.from("reviews").select("*").eq("booking_id", bookingId).maybeSingle(),
  );
}

export async function getReviewById(
  client: InkdSupabaseClient,
  id: string,
): Promise<Review | null> {
  return unwrapMaybe(
    await client.from("reviews").select("*").eq("id", id).maybeSingle(),
  );
}

/** Batch-fetch reviewer profiles for review display (avatar + first name).
 * Lives here rather than `./profiles.ts` since it exists specifically to
 * hydrate review bylines — keeps that module untouched. */
export async function listProfilesByIds(
  client: InkdSupabaseClient,
  ids: string[],
): Promise<Profile[]> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return [];
  return unwrapList(await client.from("profiles").select("*").in("id", unique));
}

const createReviewSchema = z.object({
  artist_id: z.string().uuid(),
  booking_id: z.string().uuid().nullable().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).nullable().optional(),
  body: z.string().trim().max(4000).nullable().optional(),
  is_public: z.boolean().optional(),
});

/** Client leaves a review on a completed booking. `client_id` is set to the
 * current user (RLS also enforces `client_id = auth.uid()`); the DB's unique
 * index on `booking_id` enforces one review per booking. */
export async function createReview(
  client: InkdSupabaseClient,
  clientId: string,
  input: z.input<typeof createReviewSchema>,
): Promise<Review> {
  const fields = createReviewSchema.parse(input);
  const insert: ReviewInsert = { client_id: clientId, ...fields };
  return unwrap(await client.from("reviews").insert(insert).select("*").single());
}

const updateReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(120).nullable(),
    body: z.string().trim().max(4000).nullable(),
  })
  .partial();

/** Author edits their own review's rating/title/body. The UI enforces the
 * 48h window (`isReviewEditable` in `../reviews/derive`); RLS just checks
 * `client_id = auth.uid()`. */
export async function updateReview(
  client: InkdSupabaseClient,
  id: string,
  patch: z.input<typeof updateReviewSchema>,
): Promise<Review> {
  const fields = updateReviewSchema.parse(patch) as ReviewUpdate;
  return unwrap(
    await client.from("reviews").update(fields).eq("id", id).select("*").single(),
  );
}

const artistResponseSchema = z.object({
  artist_response: z.string().trim().max(4000).nullable(),
});

/** Artist writes or edits their single response to a review (RLS checks
 * `artist_id = current_artist_id()`). Pass `null` to clear it. */
export async function setArtistReviewResponse(
  client: InkdSupabaseClient,
  id: string,
  response: string | null,
): Promise<Review> {
  const fields = artistResponseSchema.parse({ artist_response: response }) as ReviewUpdate;
  return unwrap(
    await client.from("reviews").update(fields).eq("id", id).select("*").single(),
  );
}
