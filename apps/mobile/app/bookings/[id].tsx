import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { ToastProvider } from "@inkd/ui/native";

import { BookingDetail } from "@/components/bookings/booking-detail";
import { BackButton } from "@/components/BackButton";

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <Text className="p-6 text-content-secondary">Booking not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <ToastProvider>
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-8">
          <BackButton fallback="/(tabs)/bookings" />
          <BookingDetail bookingId={id} />
        </ScrollView>
      </SafeAreaView>
    </ToastProvider>
  );
}
