import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState, Icon } from "@inkd/ui/native";

import { ScreenHeader } from "@/components/ScreenHeader";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-8 px-6 py-8">
        <ScreenHeader
          eyebrow="FEED"
          title="Your feed"
          subtitle="Fresh work from the artists you follow, all in one place."
          before={
            <View className="flex-row items-center gap-2">
              <View className="h-2.5 w-2.5 rounded-full bg-brand" />
              <Text className="font-display text-base text-content-primary">INKD</Text>
            </View>
          }
        />

        <EmptyState
          icon={<Icon name="image" size={32} color="#71717A" />}
          title="Your feed is quiet for now"
          description="New work from artists you follow will land here — start by discovering a few you like."
          action={
            <Button size="md" onPress={() => {}}>
              Discover artists
            </Button>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
