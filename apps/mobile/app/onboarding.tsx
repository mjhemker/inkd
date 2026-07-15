import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Eyebrow, EmptyState, Icon, ProgressBar } from "@inkd/ui/native";

export default function OnboardingScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-8 px-6 py-8">
        <View className="gap-4">
          <ProgressBar value={20} showValue />
          <Eyebrow>STEP 1 OF 5</Eyebrow>
          <Text className="font-display text-3xl text-content-primary">
            Set up your studio
          </Text>
          <Text className="text-sm text-content-secondary">
            A few quick steps to get your artist profile ready for clients.
          </Text>
        </View>

        <EmptyState
          icon={<Icon name="sparkles" size={32} color="#71717A" />}
          title="Onboarding starts here"
          description="Profile details, portfolio uploads, availability, and payout setup will walk you through getting live — one short step at a time."
          action={
            <Button size="md" onPress={() => {}}>
              Continue
            </Button>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
