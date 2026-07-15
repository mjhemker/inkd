/**
 * Data-access extensions for artist-side waiver template management + the
 * client signing flow's context resolution.
 *
 * Kept as a separate module (rather than editing `waivers.ts`) per repo
 * convention: extensions live in new files, and the `api/index.ts` barrel is
 * append-only. `waivers.ts` still owns the base CRUD (`listWaiverTemplates`,
 * `createWaiverTemplate`, `listSignedWaivers`, `signWaiver`); this file adds
 * the operations the /settings/waivers and /waivers/sign/[bookingId] screens
 * need on top of that.
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type {
  WaiverTemplate,
  WaiverTemplateInsert,
  UsState,
  Booking,
} from "../types/rows";
import { unwrap, unwrapList, unwrapMaybe } from "./helpers";
import { getBooking, listBookingSessions } from "./booking";
import { listStudioLocations } from "./studioLocations";

// ===========================================================================
// Template reads scoped more narrowly than listWaiverTemplates (which mixes
// the caller's own rows with global ones per RLS).
// ===========================================================================

/** Global (INKD-authored) templates only — artist_id is null. */
export async function listGlobalWaiverTemplates(
  client: InkdSupabaseClient,
): Promise<WaiverTemplate[]> {
  return unwrapList(
    await client
      .from("waiver_templates")
      .select("*")
      .is("artist_id", null)
      .eq("is_active", true)
      .order("state", { ascending: true }),
  );
}

/** An artist's own (customized) templates only. */
export async function listArtistOwnWaiverTemplates(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<WaiverTemplate[]> {
  return unwrapList(
    await client
      .from("waiver_templates")
      .select("*")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false }),
  );
}

export async function getWaiverTemplate(
  client: InkdSupabaseClient,
  id: string,
): Promise<WaiverTemplate | null> {
  return unwrapMaybe(
    await client.from("waiver_templates").select("*").eq("id", id).maybeSingle(),
  );
}

// ===========================================================================
// Artist template management: "pick" a global template (forks it into an
// artist-owned, editable row) and edit the fork's copy.
// ===========================================================================

/**
 * Fork a global template into an artist-owned row so the artist can customize
 * its copy. RLS only allows artists to insert/update rows where
 * `artist_id = current_artist_id()`, so global templates (artist_id null)
 * can never be edited in place — this is the intended "pick + customize"
 * path. Idempotent-ish: if the artist already forked a template for this
 * state, returns their existing one untouched rather than creating a
 * duplicate.
 */
export async function pickGlobalWaiverTemplate(
  client: InkdSupabaseClient,
  artistId: string,
  globalTemplateId: string,
): Promise<WaiverTemplate> {
  const source = await getWaiverTemplate(client, globalTemplateId);
  if (!source) throw new Error("pickGlobalWaiverTemplate: template not found");

  let existingQuery = client
    .from("waiver_templates")
    .select("*")
    .eq("artist_id", artistId);
  existingQuery = source.state
    ? existingQuery.eq("state", source.state)
    : existingQuery.is("state", null);
  const existing = await unwrapMaybe(await existingQuery.maybeSingle());
  if (existing) return existing;

  const insert: WaiverTemplateInsert = {
    artist_id: artistId,
    title: source.title,
    body: source.body,
    state: source.state,
    version: 1,
    is_active: true,
    required_fields: source.required_fields,
  };
  return unwrap(
    await client.from("waiver_templates").insert(insert).select("*").single(),
  );
}

const templateEditSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().min(1),
    is_active: z.boolean(),
  })
  .partial();

/** Edit an artist-owned template's copy (title/body) or toggle it active. */
export async function updateWaiverTemplate(
  client: InkdSupabaseClient,
  id: string,
  patch: z.input<typeof templateEditSchema>,
): Promise<WaiverTemplate> {
  const fields = templateEditSchema.parse(patch);
  return unwrap(
    await client
      .from("waiver_templates")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single(),
  );
}

// ===========================================================================
// Client signing flow: resolve which state/template applies to a booking.
// ===========================================================================

export interface BookingWaiverContext {
  booking: Booking;
  /** MD/PA if resolvable from the booking's session/studio location, else null
   * (falls back to the generic template). */
  state: UsState | null;
}

/**
 * Resolve the jurisdiction for a booking: the location of its (first)
 * scheduled session if one exists, else the artist's primary studio
 * location. Returns null (generic template) if neither has a state set.
 */
export async function resolveBookingWaiverContext(
  client: InkdSupabaseClient,
  bookingId: string,
): Promise<BookingWaiverContext> {
  const booking = await getBooking(client, bookingId);
  if (!booking) throw new Error("resolveBookingWaiverContext: booking not found");

  const sessions = await listBookingSessions(client, bookingId);
  const sessionLocationId = sessions.find((s) => s.location_id)?.location_id;

  const locations = await listStudioLocations(client, booking.artist_id);
  const bySession = sessionLocationId
    ? locations.find((l) => l.id === sessionLocationId)
    : undefined;
  const primary = locations.find((l) => l.is_primary) ?? locations[0];

  const state = (bySession ?? primary)?.state ?? null;
  return { booking, state };
}

/**
 * Pick the template to render for a booking: the artist's own customized
 * template for the resolved state if they have one, else the matching global
 * template, else the global generic (state-null) fallback.
 */
export async function resolveTemplateForBooking(
  client: InkdSupabaseClient,
  bookingId: string,
): Promise<{ context: BookingWaiverContext; template: WaiverTemplate | null }> {
  const context = await resolveBookingWaiverContext(client, bookingId);
  const candidates = unwrapList(
    await client
      .from("waiver_templates")
      .select("*")
      .eq("is_active", true)
      .or(`artist_id.eq.${context.booking.artist_id},artist_id.is.null`),
  );
  // Prefer artist-owned first, then narrower state match (exact state over
  // generic/null), matching how the resolveBookingWaiverContext state reads.
  const rank = (t: WaiverTemplate) => {
    const own = t.artist_id === context.booking.artist_id ? 0 : 1;
    const stateMatch = t.state === context.state ? 0 : t.state === null ? 1 : 2;
    return own * 10 + stateMatch;
  };
  const sorted = [...candidates].sort((a, b) => rank(a) - rank(b));
  return { context, template: sorted[0] ?? null };
}
