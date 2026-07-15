import "server-only";

import {
  getArtistProfileByProfileId,
  getBookingPolicy,
  getProfileByHandle,
  listArtistPosts,
  listArtistReviews,
  listArtistStyles,
  listAvailabilityRules,
  listFlashItems,
  listFlashSheets,
  listPortfolioPieces,
  listProfilesByIds,
  listPublicServices,
  listStudioLocations,
} from "@inkd/core/api";
import type {
  ArtistProfile,
  AvailabilityRule,
  BookingPolicy,
  FlashItem,
  FlashSheet,
  PortfolioPiece,
  Post,
  Profile,
  Review,
  Service,
  StudioLocation,
  Style,
} from "@inkd/core/types";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export interface PublicArtistData {
  profile: Profile;
  artist: ArtistProfile;
  isOwnProfile: boolean;
  studioLocations: StudioLocation[];
  styles: Style[];
  portfolioPieces: PortfolioPiece[];
  posts: Post[];
  flashSheets: (FlashSheet & { items: FlashItem[] })[];
  services: Service[];
  availabilityRules: AvailabilityRule[];
  bookingPolicy: BookingPolicy | null;
  reviews: Review[];
  reviewerProfiles: Record<string, Profile>;
}

/**
 * Everything the public artist profile needs, fetched server-side under the
 * viewer's own RLS session (anonymous viewers only see published/public
 * rows; the artist previewing their own page sees everything).
 */
export async function getPublicArtistData(handle: string): Promise<PublicArtistData | null> {
  const client = await getServerSupabaseClient();

  const profile = await getProfileByHandle(client, handle);
  if (!profile) return null;

  const artist = await getArtistProfileByProfileId(client, profile.id);
  if (!artist) return null;

  const {
    data: { user },
  } = await client.auth.getUser();
  const isOwnProfile = user?.id === profile.id;

  if (!artist.is_published && !isOwnProfile) return null;

  const [studioLocations, styles, portfolioPieces, posts, flashSheets, services, availabilityRules, bookingPolicy, reviews] =
    await Promise.all([
      listStudioLocations(client, artist.id),
      listArtistStyles(client, artist.id),
      listPortfolioPieces(client, artist.id),
      listArtistPosts(client, artist.id, { limit: 60 }),
      listFlashSheets(client, artist.id),
      listPublicServices(client, artist.id),
      listAvailabilityRules(client, artist.id),
      getBookingPolicy(client, artist.id),
      listArtistReviews(client, artist.id),
    ]);

  const flashSheetsWithItems = await Promise.all(
    flashSheets.map(async (sheet) => ({
      ...sheet,
      items: await listFlashItems(client, sheet.id),
    })),
  );

  const visibleReviews = reviews.filter((r) => r.is_public || isOwnProfile);
  const reviewerProfileList = await listProfilesByIds(
    client,
    visibleReviews.map((r) => r.client_id),
  );
  const reviewerProfiles = Object.fromEntries(reviewerProfileList.map((p) => [p.id, p]));

  return {
    profile,
    artist,
    isOwnProfile,
    studioLocations: studioLocations.filter((l) => l.is_public || isOwnProfile),
    styles,
    portfolioPieces: portfolioPieces.filter((p) => p.is_public || isOwnProfile),
    posts: posts.filter((p) => p.is_public || isOwnProfile),
    flashSheets: flashSheetsWithItems.filter((s) => s.is_public || isOwnProfile),
    services,
    availabilityRules,
    bookingPolicy,
    reviews: visibleReviews,
    reviewerProfiles,
  };
}
