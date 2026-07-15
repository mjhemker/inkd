import { Text, View } from "react-native";
import { cx } from "@inkd/ui/native";

/**
 * The mono "PRO" stamp — same small solid-ink-plate treatment as the AI
 * staff's TierStamp (apps/mobile/components/ai-staff/shared.tsx), used
 * wherever a premium-tier feature (api/plan.ts PLAN_FEATURES) is previewed.
 * Purely a label — it never gates anything (see PILOT_ALL_FEATURES_FREE).
 */
export function ProStamp({ className }: { className?: string }) {
  return (
    <View className={cx("rounded-sm bg-surface-plate-ink px-1.5 py-0.5", className)}>
      <Text className="font-mono text-[10px] font-semibold uppercase tracking-widest text-content-accent">
        PRO
      </Text>
    </View>
  );
}
