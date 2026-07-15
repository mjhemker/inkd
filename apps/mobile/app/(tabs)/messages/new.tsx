import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Spinner } from "@inkd/ui/native";
import { useCurrentArtistProfile, useCurrentProfile, useStartThread } from "@inkd/core/hooks";

/**
 * `/messages/new?to=<profileId>` — finds or creates the thread with that
 * profile, then replaces this modal with the chat screen.
 */
export default function NewThreadScreen() {
  const router = useRouter();
  const { to } = useLocalSearchParams<{ to?: string }>();

  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const { data: artistProfile, isLoading: artistLoading } = useCurrentArtistProfile();
  const startThread = useStartThread();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    if (profileLoading || artistLoading) return;
    if (!to) {
      setError("Missing the person to message.");
      return;
    }
    if (!profile) {
      setError("Sign in to start a conversation.");
      return;
    }
    attempted.current = true;
    startThread.mutate(
      {
        currentProfileId: profile.id,
        currentArtistProfileId: artistProfile?.id ?? null,
        targetProfileId: to,
      },
      {
        onSuccess: (thread) => router.replace(`/messages/${thread.id}`),
        onError: (err) =>
          setError(err instanceof Error ? err.message : "Couldn't start that conversation."),
      },
    );
  }, [to, profile, artistProfile, profileLoading, artistLoading, startThread, router]);

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-surface-base px-8">
      {error ? (
        <View className="items-center gap-2">
          <Text className="text-center font-sans-semibold text-sm text-content-primary">
            Couldn&apos;t start that conversation
          </Text>
          <Text className="text-center text-sm text-content-muted">{error}</Text>
        </View>
      ) : (
        <View className="items-center gap-3">
          <Spinner size="small" />
          <Text className="text-sm text-content-muted">Starting conversation…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
