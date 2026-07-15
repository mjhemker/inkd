import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useCurrentProfile, useInkdClient, getCurrentArtistProfile } from "@inkd/core";
import { Skeleton, ToastProvider } from "@inkd/ui/native";

import { ArtistBookings } from "@/components/bookings/artist-bookings";
import { ClientBookings } from "@/components/bookings/client-bookings";

export default function BookingsScreen() {
  return (
    <ToastProvider>
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <ScrollView className="flex-1" contentContainerClassName="gap-8 px-6 py-8">
          <BookingsHub />
        </ScrollView>
      </SafeAreaView>
    </ToastProvider>
  );
}

function BookingsHub() {
  const client = useInkdClient();
  const profileQ = useCurrentProfile();
  const artistQ = useQuery({
    queryKey: ["currentArtistProfile"],
    queryFn: () => getCurrentArtistProfile(client),
  });

  if (profileQ.isLoading || artistQ.isLoading) {
    return (
      <View className="gap-6">
        <Skeleton className="h-9 w-48" />
        <View className="flex-row gap-3">
          <Skeleton className="h-24 flex-1" />
          <Skeleton className="h-24 flex-1" />
          <Skeleton className="h-24 flex-1" />
        </View>
        <Skeleton className="h-64 w-full" />
      </View>
    );
  }

  if (artistQ.data) {
    return <ArtistBookings artistId={artistQ.data.id} artistProfileId={profileQ.data?.id ?? ""} />;
  }

  return <ClientBookings clientId={profileQ.data?.id ?? ""} />;
}
