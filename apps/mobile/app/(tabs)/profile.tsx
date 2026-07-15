import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState, Icon } from "@inkd/ui/native";

import { ScreenHeader } from "@/components/ScreenHeader";

export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-8 px-6 py-8">
        <ScreenHeader
          eyebrow="PROFILE"
          title="Profile"
          subtitle="Your portfolio, reviews, and public presence."
        />

        <EmptyState
          icon={<Icon name="user" size={32} color="#71717A" />}
          title="Your profile is just getting started"
          description="Portfolio pieces, client reviews, and booking details will show up here once you build them out."
          action={
            <Button size="md" onPress={() => {}}>
              Edit profile
            </Button>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
