import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Card, Icon, type IconName } from "@inkd/ui/native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { AiStaffDashboardCard } from "@/components/ai-staff/DashboardCard";
import { useTheme } from "@/providers/theme";

/**
 * Artist STUDIO hub (mobile). The ops wedge that the web sidebar shows as its
 * "Studio" group, consolidated behind one tab so the phone's 5-tab bar keeps
 * the consumer surfaces (Home / Discover / Messages / Profile) one tap away.
 * Bookings lives here for artists (clients keep it as their own tab).
 */
const LINKS: { href: string; icon: IconName; title: string; subtitle: string }[] = [
  {
    href: "/dashboard",
    icon: "layout-grid",
    title: "Dashboard",
    subtitle: "Revenue, requests, and studio activity",
  },
  {
    href: "/bookings",
    icon: "calendar",
    title: "Bookings",
    subtitle: "Your pipeline, requests, and calendar",
  },
  {
    href: "/studio/ai",
    icon: "sparkles",
    title: "AI staff",
    subtitle: "Approvals, activity ledger, and playbook",
  },
  {
    href: "/settings",
    icon: "settings",
    title: "Settings",
    subtitle: "Profile, hours, services, and waivers",
  },
];

export default function StudioScreen() {
  const { colors } = useTheme();
  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-8">
        <ScreenHeader
          eyebrow="STUDIO"
          title="Studio"
          subtitle="Run your books — dashboard, bookings, and your AI staff."
        />

        <AiStaffDashboardCard />

        <View className="gap-3">
          {LINKS.map((link) => (
            <Card
              key={link.href}
              padding="md"
              variant="interactive"
              onPress={() => router.push(link.href)}
              className="flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-sm bg-surface-plate-ink">
                  <Icon name={link.icon} size={19} color={colors.text.accent} />
                </View>
                <View>
                  <Text className="text-sm font-sans-semibold text-content-primary">
                    {link.title}
                  </Text>
                  <Text className="text-xs text-content-muted">{link.subtitle}</Text>
                </View>
              </View>
              <Icon name="chevron-right" size={18} color={colors.text.muted} />
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
