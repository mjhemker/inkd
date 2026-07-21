import { Pressable, ScrollView, Text, View } from "react-native";
import { cx } from "@inkd/ui/native";
import { useAttentionCounts } from "@inkd/core/hooks";

import { STUDIO_SECTIONS, type StudioSection } from "@/lib/nav";

/**
 * Segmented header for the Studio tab: Dashboard | Bookings | AI staff |
 * Settings. The Studio tab is a SINGLE screen — selecting a segment swaps the
 * body below IN PLACE via `onSelect` (local state on StudioScreen), with no
 * navigation and no slide.
 *
 * This is a LOCAL, deliberately prominent segmented control (not the shared
 * `Tabs` primitive, which is owned by another agent): per the founder redesign
 * the bar now CARRIES the section label, so it's larger + bolder with a strong
 * solid-brand active plate. Per-item attention badges ride in the label row.
 */

/** Alert-red attention pill (9+ cap), matching the web nav badges (danger-600). */
function SegmentBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <View
      className={cx(
        "ml-1 min-w-5 items-center justify-center rounded-full px-1.5 py-0.5",
        active ? "bg-white/25" : "bg-danger-600",
      )}
    >
      <Text className="font-mono text-[10px] font-sans-semibold text-neutral-50">
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

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-none"
      contentContainerClassName="flex-row items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-raised p-1.5"
    >
      {STUDIO_SECTIONS.map((s) => {
        const isActive = s.value === active;
        const count = countFor[s.value] ?? 0;
        return (
          <Pressable
            key={s.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => {
              if (s.value !== active) onSelect(s.value);
            }}
            className={cx(
              "min-h-11 flex-row items-center justify-center rounded-lg px-4 py-2.5",
              isActive ? "bg-brand" : "bg-transparent active:bg-surface-overlay",
            )}
          >
            <Text
              className={cx(
                "text-base",
                isActive
                  ? "font-sans-bold text-brand-on"
                  : "font-sans-semibold text-content-secondary",
              )}
            >
              {s.label}
            </Text>
            {count > 0 ? <SegmentBadge count={count} active={isActive} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
