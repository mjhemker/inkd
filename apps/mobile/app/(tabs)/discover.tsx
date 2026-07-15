import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState, Icon } from "@inkd/ui/native";

import { ScreenHeader } from "@/components/ScreenHeader";

export default function DiscoverScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-8 px-6 py-8">
        <ScreenHeader
          eyebrow="DISCOVER"
          title="Discover"
          subtitle="Find artists near you, filtered by style."
        />

        <EmptyState
          icon={<Icon name="compass" size={32} color="#71717A" />}
          title="The map is warming up"
          description="A local map with style filters will let you browse nearby studios and find your next artist."
          action={
            <Button size="md" onPress={() => {}}>
              Set your location
            </Button>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
