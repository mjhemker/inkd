import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Skeleton, ToastProvider } from "@inkd/ui/native";
import { useCurrentArtistProfile, useCurrentProfile } from "@inkd/core";

import { ArtistBookings } from "@/components/bookings/artist-bookings";
import { ArtistOnly } from "@/components/ArtistOnly";
import { StudioSegments } from "@/components/studio/StudioSegments";

/**
 * Studio tab → Bookings. The artist booking cockpit (requests, pipeline,
 * calendar) inside the Studio tab's nested stack, so the bottom tab bar stays
 * visible. Tapping a booking/request pushes a root-level detail screen that
 * covers the bar by design. Clients reach their own bookings from Profile
 * (app/(tabs)/bookings.tsx), never here.
 */
export default function StudioBookingsScreen() {
  return (
    <ArtistOnly requireOnboarding>
      <ToastProvider>
        <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
          <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-8">
            <StudioSegments active="bookings" />
            <StudioBookingsBody />
          </ScrollView>
        </SafeAreaView>
      </ToastProvider>
    </ArtistOnly>
  );
}

function StudioBookingsBody() {
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
