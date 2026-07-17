import { Text, View } from "react-native";
import { router } from "expo-router";
import { Tabs } from "@inkd/ui/native";
import { useAttentionCounts } from "@inkd/core/hooks";

import { STUDIO_SECTIONS, type StudioSection } from "@/lib/nav";

/**
 * Segmented header for the Studio tab: Dashboard | Bookings | AI staff |
 * Settings. Each screen lives in the Studio tab's nested stack
 * (app/(tabs)/studio/*), so switching sections keeps the bottom tab bar
 * visible throughout. Uses the shared `Tabs` primitive as-is (styling is owned
 * by another agent — do not restyle here); per-item attention badges are fed
 * through the primitive's additive `badge` slot, matching the web nav.
 * Switching sections `replace`s the current route so the sections stay peers
 * with no back-stack pile-up.
 */
const ROUTE_BY_SECTION: Record<StudioSection, string> = Object.fromEntries(
  STUDIO_SECTIONS.map((s) => [s.value, s.route]),
) as Record<StudioSection, string>;

/** Ember attention pill (9+ cap), matching the web nav badges. */
function SegmentBadge({ count }: { count: number }) {
  return (
    <View className="ml-0.5 min-w-5 items-center justify-center rounded-full bg-surface-ember px-1.5 py-0.5">
      <Text className="font-mono text-[10px] font-sans-semibold text-brand-on-ember">
        {count > 9 ? "9+" : count}
      </Text>
    </View>
  );
}

export function StudioSegments({ active }: { active: StudioSection }) {
  const attention = useAttentionCounts();
  const countFor: Partial<Record<StudioSection, number>> = {
    bookings: attention.bookings,
    ai: attention.aiStaff,
  };
  const items = STUDIO_SECTIONS.map((s) => {
    const count = countFor[s.value] ?? 0;
    return {
      value: s.value,
      label: s.label,
      badge: count > 0 ? <SegmentBadge count={count} /> : undefined,
    };
  });
  return (
    <Tabs
      value={active}
      items={items}
      onValueChange={(value) => {
        if (value !== active) router.replace(ROUTE_BY_SECTION[value as StudioSection] as never);
      }}
    />
  );
}
