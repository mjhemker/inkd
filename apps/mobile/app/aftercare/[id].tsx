import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { ToastProvider } from "@inkd/ui/native";

import { AftercareCheckinScreen } from "@/components/aftercare/checkin-screen";
import { BackButton } from "@/components/BackButton";

export default function AftercareCheckinRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <Text className="p-6 text-content-secondary">Check-in not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <ToastProvider>
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-8">
          <BackButton fallback="/(tabs)" />
          <AftercareCheckinScreen checkinId={id} />
        </ScrollView>
      </SafeAreaView>
    </ToastProvider>
  );
}
