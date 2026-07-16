/**
 * Mock `PublicArtistData` for the /dev/profile-preview/public harness — same
 * network-block workaround as ../seed.ts, but shaped for `ArtistProfileView`
 * (which takes fully-resolved data as a prop rather than reading through
 * hooks), so no mock Supabase client is needed here.
 */
import type { PublicArtistData } from "../../a/[handle]/data";
import { demoSeed } from "./seed";

type Row = Record<string, unknown>;

const t = demoSeed.tables;

const profile = t.profiles![0] as unknown as PublicArtistData["profile"];
const artist = t.artist_profiles![0] as unknown as PublicArtistData["artist"];

const artistStyleIds = new Set((t.artist_styles as Row[]).map((row) => row.style_id as string));
const styles = (t.styles as Row[]).filter((s) => artistStyleIds.has(s.id as string)) as unknown as PublicArtistData["styles"];

const flashSheetsWithItems = (t.flash_sheets as Row[]).map((sheet) => ({
  ...sheet,
  items: (t.flash_items as Row[]).filter((item) => item.flash_sheet_id === sheet.id),
})) as unknown as PublicArtistData["flashSheets"];

const reviews = (t.reviews ?? []) as unknown as PublicArtistData["reviews"];
const reviewerProfiles = Object.fromEntries(
  (t.profiles as Row[])
    .filter((p) => reviews.some((r) => r.client_id === p.id))
    .map((p) => [p.id, p]),
) as PublicArtistData["reviewerProfiles"];

export const publicDemoData: PublicArtistData = {
  profile,
  artist,
  isOwnProfile: false,
  studioLocations: t.studio_locations as unknown as PublicArtistData["studioLocations"],
  styles,
  portfolioPieces: t.portfolio_pieces as unknown as PublicArtistData["portfolioPieces"],
  posts: t.posts as unknown as PublicArtistData["posts"],
  flashSheets: flashSheetsWithItems,
  services: t.services as unknown as PublicArtistData["services"],
  availabilityRules: t.availability_rules as unknown as PublicArtistData["availabilityRules"],
  bookingPolicy: (t.booking_policies?.[0] ?? null) as unknown as PublicArtistData["bookingPolicy"],
  reviews,
  reviewerProfiles,
  shopBadges: [
    {
      shop_id: "shop-demo",
      handle: "fells-point-ink",
      name: "Fells Point Ink",
      role: "resident",
      membership_mode: "managed",
    },
  ],
};
