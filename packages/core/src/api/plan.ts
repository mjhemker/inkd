/**
 * Data access + helpers: `artist_profiles.plan` — the premium tier scaffold
 * (SPEC §0: "everything free for now ... subscription tiers later add premium
 * ops/AI features and remove client booking fees").
 *
 * This is intentionally light: a plan column, a features map for UI copy, and
 * `getPlan`/`isPro` readers. There is NO enforcement/gating logic here or
 * anywhere else yet — `PILOT_ALL_FEATURES_FREE` documents that honestly:
 * every pilot artist gets every feature for free, full stop, regardless of
 * `plan`. When billing ships, gating reads `isPro(...)` at the call sites that
 * need it; nothing here has to change.
 */
import type { InkdSupabaseClient } from "../supabase/client";
import { unwrapMaybe } from "./helpers";

export type PlanTier = "free" | "pro";

/** The minimal shape `getPlan`/`isPro` need — works with a full ArtistProfile
 * row, a partial select, or a plain object (e.g. dev fixtures). */
export interface PlanSource {
  plan?: string | null;
}

/** During the pilot every artist gets every feature for free, regardless of
 * `plan` (Michael, SPEC §0). Referenced by settings copy so the "coming soon"
 * card can say this honestly instead of implying a paywall exists today. */
export const PILOT_ALL_FEATURES_FREE = true;

export interface PlanFeature {
  key: string;
  label: string;
  description: string;
  /** The plan tier this feature belongs to once billing exists. */
  tier: PlanTier;
}

/**
 * What ships behind Pro once subscriptions exist (SPEC §0 + §5). Kept as an
 * ordered array (not a lookup map) so the settings "coming soon" card can
 * render it directly as a feature list.
 */
export const PLAN_FEATURES: readonly PlanFeature[] = [
  {
    key: "autonomy_assisted",
    label: "Assisted autonomy",
    description:
      "Your Front Desk auto-sends answers it can fully ground in your published info; everything else still drafts for your approval.",
    tier: "pro",
  },
  {
    key: "autonomy_managed",
    label: "Managed autonomy",
    description:
      "Routine replies go out on their own and bookings are proposed for a one-tap confirm — you stay in the loop on anything that commits time or money.",
    tier: "pro",
  },
  {
    key: "studio_manager",
    label: "Studio Manager",
    description:
      "Deposit chasing, rebooking nudges, and a weekly business digest — the parts of running a studio that fall through the cracks.",
    tier: "pro",
  },
  {
    key: "growth_advisor",
    label: "Growth Advisor",
    description:
      "Marketing and post suggestions, review requests — always suggestion-only, never posts on its own.",
    tier: "pro",
  },
  {
    key: "fee_free_bookings",
    label: "Fee-free client bookings",
    description: "INKD's booking fee is waived on your clients' transactions.",
    tier: "pro",
  },
] as const;

/** Read the plan tier from any artist-shaped row; an unrecognized or missing
 * value is always treated as 'free' (fail safe, never fail open). */
export function getPlan(artist: PlanSource | null | undefined): PlanTier {
  return artist?.plan === "pro" ? "pro" : "free";
}

/** Is this artist on Pro? During the pilot this is purely informational — see
 * `PILOT_ALL_FEATURES_FREE`. Nothing in the product gates on this yet. */
export function isPro(artist: PlanSource | null | undefined): boolean {
  return getPlan(artist) === "pro";
}

/** Fetch just the plan column for one artist (avoids over-fetching the row
 * when the caller only needs the tier). */
export async function fetchArtistPlan(
  client: InkdSupabaseClient,
  artistId: string,
): Promise<PlanTier> {
  const row = unwrapMaybe(
    await client.from("artist_profiles").select("plan").eq("id", artistId).maybeSingle(),
  );
  return getPlan(row as PlanSource | null);
}
