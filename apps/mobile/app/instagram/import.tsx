/**
 * Route: /instagram/import — the full-screen Instagram picker (guide §3.D).
 * Entered from Settings → "Import posts" (origin=settings) and from onboarding
 * Step 1 (origin=onboarding). Wraps its own ToastProvider (the root Stack
 * doesn't provide one) and resolves the current artist.
 */
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Spinner, ToastProvider } from "@inkd/ui/native";
import { useCurrentArtistProfile } from "@inkd/core/hooks";

import { BackButton } from "@/components/BackButton";
import { InstagramPicker } from "@/components/instagram/InstagramPicker";

export default function InstagramImportScreen() {
  return (
    <ToastProvider>
      <InstagramImportRoute />
    </ToastProvider>
  );
}

function InstagramImportRoute() {
  const params = useLocalSearchParams<{ origin?: string }>();
  const origin = params.origin === "onboarding" ? "onboarding" : "settings";
  const { data: artist, isLoading } = useCurrentArtistProfile();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface-base">
        <Spinner size="large" />
      </SafeAreaView>
    );
  }

  if (!artist) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top"]}>
        <View className="px-4 pt-1">
          <BackButton fallback="/(tabs)/studio/settings" />
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-sm text-content-secondary">
            Set up your artist profile before importing from Instagram.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return <InstagramPicker artistId={artist.id} origin={origin} />;
}
