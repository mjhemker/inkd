import { Text, View } from "react-native";
import { Tabs } from "@inkd/ui/native";
import { useAttentionCounts } from "@inkd/core/hooks";

import { STUDIO_SECTIONS, type StudioSection } from "@/lib/nav";

/**
 * Segmented header for the Studio tab: Dashboard | Bookings | AI staff |
 * Settings. The Studio tab is a SINGLE screen — selecting a segment swaps the
 * body below IN PLACE via `onSelect` (local state on StudioScreen), with no
 * navigation and no slide. Uses the shared `Tabs` primitive as-is (styling is
 * owned by another agent — do not restyle here); per-item attention badges are
 * fed through the primitive's additive `badge` slot, matching the web nav.
 */

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

export function StudioSegments({
  active,
  onSelect,
}: {
  active: StudioSection;
  onSelect: (section: StudioSection) => void;
}) {
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
        if (value !== active) onSelect(value as StudioSection);
      }}
    />
  );
}
