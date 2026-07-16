import { Text, View } from "react-native";
import { Card, Icon } from "@inkd/ui/native";
import { PLAN_FEATURES } from "@inkd/core";
import { ProStamp } from "./ProStamp";
import { useTheme } from "@/providers/theme";

/**
 * "INKD Pro — coming soon" placard. No payment CTA — subscriptions aren't
 * live yet (SPEC §0). Honest framing: every pilot artist already has every
 * feature below for free (api/plan.ts PILOT_ALL_FEATURES_FREE); this card
 * previews what becomes a paid tier once billing ships.
 */
export function PlanCard() {
  const { colors } = useTheme();
  return (
    <Card padding="lg" className="gap-5">
      <View className="flex-row items-center gap-2.5">
        <View className="h-10 w-10 items-center justify-center rounded-lg bg-surface-overlay">
          <Icon name="sparkles" size={19} color={colors.text.accent} />
        </View>
        <View className="gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-sans-semibold text-content-primary">INKD Pro</Text>
            <ProStamp />
          </View>
          <Text className="text-xs text-content-muted">Coming soon</Text>
        </View>
      </View>

      <Text className="text-sm text-content-secondary">
        During the pilot, every feature below is included free on your account —
        no catch. When subscriptions launch, these become the INKD Pro tier;
        we&apos;ll tell you well before anything changes for you.
      </Text>

      <View className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
        {PLAN_FEATURES.map((f) => (
          <View key={f.key} className="gap-0.5 px-4 py-3">
            <Text className="text-sm font-sans-medium text-content-primary">{f.label}</Text>
            <Text className="text-xs text-content-muted">{f.description}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
