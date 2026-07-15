import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState, Icon } from "@inkd/ui/native";

import { ScreenHeader } from "@/components/ScreenHeader";

export default function BookingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-8 px-6 py-8">
        <ScreenHeader
          eyebrow="STUDIO"
          title="Bookings"
          subtitle="Track requests, deposits, and appointments in one pipeline."
        />

        <EmptyState
          icon={<Icon name="calendar" size={32} color="#71717A" />}
          title="No bookings yet"
          description="Your booking pipeline — requests, deposits, and confirmed dates — will show up here as clients reach out."
          action={
            <Button size="md" onPress={() => {}}>
              New booking
            </Button>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
