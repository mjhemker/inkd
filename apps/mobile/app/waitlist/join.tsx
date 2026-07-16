/**
 * Join-the-waitlist screen. Reached from an artist's profile / booking flow
 * when a desired time isn't open. Params: artistId, artistName.
 */
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useCurrentProfile, useServices, useJoinWaitlist } from "@inkd/core";
import { Skeleton, ToastProvider, useToast } from "@inkd/ui/native";

import { WaitlistJoinForm } from "@/components/waitlist/join-form";

export default function WaitlistJoinScreen() {
  const { artistId, artistName } = useLocalSearchParams<{ artistId: string; artistName?: string }>();

  if (!artistId) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <Text className="p-6 text-content-secondary">Artist not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <ToastProvider>
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-8">
          <Text
            onPress={() => (router.canGoBack() ? router.back() : router.push("/(tabs)/bookings"))}
            className="text-sm text-content-secondary"
          >
            {"< Back"}
          </Text>
          <JoinBody artistId={artistId} artistName={artistName} />
        </ScrollView>
      </SafeAreaView>
    </ToastProvider>
  );
}

function JoinBody({ artistId, artistName }: { artistId: string; artistName?: string }) {
  const { toast } = useToast();
  const profileQ = useCurrentProfile();
  const servicesQ = useServices(artistId);
  const join = useJoinWaitlist(profileQ.data?.id ?? "");

  if (profileQ.isLoading) return <Skeleton className="h-64 w-full" />;

  const services = (servicesQ.data ?? [])
    .filter((s) => s.is_public)
    .map((s) => ({ id: s.id, name: s.name }));

  return (
    <View className="gap-4">
      <WaitlistJoinForm
        artistId={artistId}
        artistName={artistName}
        services={services}
        submitting={join.isPending}
        onSubmit={(input) =>
          join.mutate(input, {
            onSuccess: () => {
              toast({ title: "You're on the waitlist", variant: "success" });
              router.push("/bookings/waitlist");
            },
            onError: (e: unknown) => toast({ title: (e as Error).message ?? "Could not join", variant: "danger" }),
          })
        }
      />
    </View>
  );
}
