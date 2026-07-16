import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button, EmptyState, Icon } from "@inkd/ui/native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { AiStaffDashboardCard } from "@/components/ai-staff/DashboardCard";
import { ArtistOnly } from "@/components/ArtistOnly";

export default function DashboardScreen() {
  return (
    <ArtistOnly requireOnboarding>
      <DashboardContent />
    </ArtistOnly>
  );
}

function DashboardContent() {
  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-8">
        <ScreenHeader
          eyebrow="STUDIO OPS"
          title="Dashboard"
          subtitle="Your operational overview — bookings, revenue, and requests at a glance."
        />

        <AiStaffDashboardCard />

        <EmptyState
          icon={<Icon name="layout-grid" size={32} color="#71717A" />}
          title="Your ops overview is on its way"
          description="Revenue, booking requests, and studio activity will surface here for a real-time read on your business."
          action={
            <Button size="md" onPress={() => router.push("/bookings")}>
              Go to bookings
            </Button>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
