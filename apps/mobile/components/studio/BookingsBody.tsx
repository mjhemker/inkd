import { View } from "react-native";
import { Skeleton } from "@inkd/ui/native";
import { useCurrentArtistProfile, useCurrentProfile } from "@inkd/core";

import { ArtistBookings } from "@/components/bookings/artist-bookings";

/**
 * Studio → Bookings body (the artist booking cockpit). Header + segmented bar
 * are owned by StudioScreen. Tapping a booking/request still pushes a
 * root-level detail screen that covers the bottom bar by design.
 */
export function BookingsBody() {
  const profileQ = useCurrentProfile();
  const artistQ = useCurrentArtistProfile();

  if (profileQ.isLoading || artistQ.isLoading || !artistQ.data) {
    return (
      <View className="gap-6">
        <View className="flex-row gap-3">
          <Skeleton className="h-24 flex-1" />
          <Skeleton className="h-24 flex-1" />
          <Skeleton className="h-24 flex-1" />
        </View>
        <Skeleton className="h-64 w-full" />
      </View>
    );
  }

  return (
    <ArtistBookings
      artistId={artistQ.data.id}
      artistProfileId={profileQ.data?.id ?? ""}
    />
  );
}
