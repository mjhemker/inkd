/**
 * Additional query-key builders for wave-2 profile/portfolio surfaces.
 * Companion to `./queryKeys.ts` (kept in a new file — that module is
 * append-only from other agents' perspective, this one is ours).
 */
export const contentQueryKeys = {
  currentArtistProfile: () => ["currentArtistProfile"] as const,
  artistProfile: (id: string) => ["artistProfile", id] as const,
  profileByHandle: (handle: string) => ["profileByHandle", handle.toLowerCase()] as const,
  artistStyles: (artistId: string) => ["artistStyles", artistId] as const,
  styles: () => ["styles"] as const,
  studioLocations: (artistId: string) => ["studioLocations", artistId] as const,
  posts: (artistId: string) => ["posts", artistId] as const,
  portfolioPieces: (artistId: string) => ["portfolioPieces", artistId] as const,
  flashSheets: (artistId: string) => ["flashSheets", artistId] as const,
  flashItems: (flashSheetId: string) => ["flashItems", flashSheetId] as const,
} as const;
