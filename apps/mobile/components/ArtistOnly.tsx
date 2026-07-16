/**
 * Route guard for the artist-only "Studio" screens (dashboard, settings,
 * AI staff). Clients — and downgraded artists (is_artist=false) — get an honest
 * "artist account required" state instead of a half-rendered artist surface,
 * mirroring the web middleware role gate. When `requireOnboarding` is set, an
 * artist who hasn't finished onboarding is nudged to complete it first.
 */
import type { ReactNode } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState, Icon, Spinner } from "@inkd/ui/native";
import { useCurrentArtistProfile, useCurrentProfile } from "@inkd/core/hooks";

export function ArtistOnly({
  children,
  requireOnboarding = false,
}: {
  children: ReactNode;
  requireOnboarding?: boolean;
}) {
  const { data: profile, isLoading: pLoading } = useCurrentProfile();
  const { data: artist, isLoading: aLoading } = useCurrentArtistProfile();

  if (pLoading || aLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface-base">
        <Spinner size="large" />
      </SafeAreaView>
    );
  }

  if (!profile?.is_artist) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <View className="flex-1 justify-center px-6">
          <EmptyState
            icon={<Icon name="shield" size={32} color="#71717A" />}
            title="Artist account required"
            description="This is part of the studio tools for tattoo artists. Your account is set up as a client."
            action={
              <Button size="md" onPress={() => router.replace("/(tabs)")}>
                Back to home
              </Button>
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  if (requireOnboarding && (!artist || !artist.onboarding_completed_at)) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <View className="flex-1 justify-center px-6">
          <EmptyState
            icon={<Icon name="sparkles" size={32} color="#A78BFA" />}
            title="Finish setting up your studio"
            description="Complete onboarding to unlock your dashboard, AI staff, and studio tools."
            action={
              <Button size="md" onPress={() => router.replace("/onboarding")}>
                Finish setup
              </Button>
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}
