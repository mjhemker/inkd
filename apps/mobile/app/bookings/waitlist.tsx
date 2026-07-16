import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useCurrentProfile, useInkdClient, getCurrentArtistProfile } from "@inkd/core";
import { Skeleton, ToastProvider } from "@inkd/ui/native";

import { ClientWaitlist } from "@/components/waitlist/client-waitlist";
import { ArtistWaitlist } from "@/components/waitlist/artist-waitlist";

export default function WaitlistScreen() {
  return (
    <ToastProvider>
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-8">
          <BackLink />
          <WaitlistHub />
        </ScrollView>
      </SafeAreaView>
    </ToastProvider>
  );
}

function WaitlistHub() {
  const client = useInkdClient();
  const profileQ = useCurrentProfile();
  const artistQ = useQuery({
    queryKey: ["currentArtistProfile"],
    queryFn: () => getCurrentArtistProfile(client),
  });

  if (profileQ.isLoading || artistQ.isLoading) {
    return (
      <View className="gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 w-full" />
      </View>
    );
  }

  if (artistQ.data) {
    return (
      <ArtistWaitlist
        artistId={artistQ.data.id}
        waitlistEnabled={artistQ.data.waitlist_enabled ?? true}
      />
    );
  }

  return <ClientWaitlist clientId={profileQ.data?.id ?? ""} />;
}

function BackLink() {
  return (
    <Text
      onPress={() => (router.canGoBack() ? router.back() : router.push("/(tabs)/bookings"))}
      className="text-sm text-content-secondary"
    >
      {"< Bookings"}
    </Text>
  );
}
