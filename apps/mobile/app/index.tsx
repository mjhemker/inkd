import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const pillars = [
  {
    title: "Artist ops",
    body: "Onboarding, availability, bookings, deposits, waivers and chat — the wedge.",
  },
  {
    title: "Client discovery",
    body: "Style-tagged feed, local map, profiles, and a booking flow that works.",
  },
  {
    title: "AI staff",
    body: "Operational agents that show their work — Front Desk, Booking Manager, Studio Manager.",
  },
];

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 py-10 gap-8"
      >
        <View className="flex-row items-center gap-2">
          <View className="h-5 w-5 rounded-md bg-brand" />
          <Text className="text-lg font-bold text-content-primary">INKD</Text>
        </View>

        <View className="gap-4">
          <Text className="text-xs font-semibold uppercase tracking-widest text-content-accent">
            Monorepo online
          </Text>
          <Text className="text-4xl font-bold leading-tight text-content-primary">
            The operating system for independent tattoo artists.
          </Text>
          <Text className="text-base text-content-secondary">
            Web and mobile, built in tandem on a shared Supabase backend. This is
            the Phase 0 scaffold — brand tokens, shared core, and app shells are
            in place and ready for feature work.
          </Text>
        </View>

        <View className="gap-4">
          {pillars.map((pillar) => (
            <View
              key={pillar.title}
              className="rounded-xl border border-border-subtle bg-surface-raised p-5"
            >
              <Text className="mb-2 text-base font-semibold text-content-primary">
                {pillar.title}
              </Text>
              <Text className="text-sm text-content-secondary">
                {pillar.body}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
