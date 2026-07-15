/**
 * Placeholder domain types for INKD.
 *
 * These are intentionally minimal for the P0 scaffold; the full data model
 * (profiles, artist_profiles, bookings, sessions, payments, waivers, threads,
 * agent_actions, …) lands with the schema work in later phases (SPEC §2).
 */

/** A user's active role. Artists extend clients. */
export type UserRole = "client" | "artist";

/** How an artist operates out of their studio location(s) (SPEC §2). */
export type ArtistClassification =
  | "shop_owner"
  | "shop_resident"
  | "private_suite"
  | "independent";

/** Agent autonomy levels for the artist-controlled slider (SPEC §5). */
export type AgentAutonomy =
  | "no_ai"
  | "draft_only"
  | "assisted"
  | "managed";

export interface AppUser {
  id: string;
  role: UserRole;
  handle: string;
  displayName: string;
}
