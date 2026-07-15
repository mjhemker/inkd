/**
 * Client-side aggregate fetch for a public artist profile by handle — the
 * mobile equivalent of the web app's server-rendered `/a/[handle]` data
 * loader (Expo has no server component tier, so this composes the same
 * reads behind a single `useQuery`).
 */
import { useQuery } from "@tanstack/react-query";

import {
  getArtistProfileByProfileId,
  getBookingPolicy,
  getProfileByHandle,
  listArtistPosts,
  listArtistStyles,
  listAvailabilityRules,
  listFlashItems,
  listFlashSheets,
  listPortfolioPieces,
  listPublicServices,
  listStudioLocations,
} from "../api";
import type {
  ArtistProfile,
  AvailabilityRule,
  BookingPolicy,
  FlashItem,
  FlashSheet,
  PortfolioPiece,
  Post,
  Profile,
  Service,
  StudioLocation,
  Style,
} from "../types/rows";
import { useInkdClient } from "./context";

export interface PublicArtistProfileData {
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
}

export function usePublicArtistProfile(handle: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: ["publicArtistProfile", handle?.toLowerCase() ?? ""] as const,
    enabled: Boolean(handle),
    queryFn: async (): Promise<PublicArtistProfileData | null> => {
      const profile = await getProfileByHandle(client, handle as string);
      if (!profile) return null;

      const artist = await getArtistProfileByProfileId(client, profile.id);
      if (!artist) return null;

      const {
        data: { user },
      } = await client.auth.getUser();
      const isOwnProfile = user?.id === profile.id;
      if (!artist.is_published && !isOwnProfile) return null;

      const [
        studioLocations,
        styles,
        portfolioPieces,
        posts,
        flashSheets,
        services,
        availabilityRules,
        bookingPolicy,
      ] = await Promise.all([
        listStudioLocations(client, artist.id),
        listArtistStyles(client, artist.id),
        listPortfolioPieces(client, artist.id),
        listArtistPosts(client, artist.id, { limit: 60 }),
        listFlashSheets(client, artist.id),
        listPublicServices(client, artist.id),
        listAvailabilityRules(client, artist.id),
        getBookingPolicy(client, artist.id),
      ]);

      const flashSheetsWithItems = await Promise.all(
        flashSheets.map(async (sheet) => ({
          ...sheet,
          items: await listFlashItems(client, sheet.id),
        })),
      );

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
      };
    },
  });
}
