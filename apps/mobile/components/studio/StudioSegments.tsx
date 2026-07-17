import { router } from "expo-router";
import { Tabs } from "@inkd/ui/native";

import { STUDIO_SECTIONS, type StudioSection } from "@/lib/nav";

/**
 * Segmented header for the Studio tab: Dashboard | Bookings | AI staff |
 * Settings. Each screen lives in the Studio tab's nested stack
 * (app/(tabs)/studio/*), so switching sections keeps the bottom tab bar
 * visible throughout. Uses the shared `Tabs` primitive as-is (styling is owned
 * by another agent — do not restyle here). Switching sections `replace`s the
 * current route so the sections stay peers with no back-stack pile-up.
 */
const ITEMS = STUDIO_SECTIONS.map((s) => ({ value: s.value, label: s.label }));
const ROUTE_BY_SECTION: Record<StudioSection, string> = Object.fromEntries(
  STUDIO_SECTIONS.map((s) => [s.value, s.route]),
) as Record<StudioSection, string>;

export function StudioSegments({ active }: { active: StudioSection }) {
  return (
    <Tabs
      value={active}
      items={ITEMS}
      onValueChange={(value) => {
        if (value !== active) router.replace(ROUTE_BY_SECTION[value as StudioSection] as never);
      }}
    />
  );
}
