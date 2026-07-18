import { Stack } from "expo-router";

import { useTheme } from "@/providers/theme";

/**
 * Nested stack for the Studio tab. The bottom tab bar (owned by the outer
 * (tabs)/_layout) stays visible on every screen here.
 *
 * The four primary sections — dashboard (index), bookings, AI staff, settings —
 * are NOT separate screens the user slides between: they all mount the SAME
 * single Studio screen (components/studio/StudioScreen.tsx) at a matching
 * initial segment, and the segmented bar swaps the body IN PLACE (local state,
 * no navigation). These routes remain registered only as deep-link entry
 * points so /studio/bookings, /studio/ai, /studio/settings (+ their ?params)
 * from notifications and legacy links still resolve. `shop` is a real drill-in
 * pushed on top.
 *
 * Push screens that intentionally COVER the tab bar (booking detail, message
 * thread, waivers, public pages) stay at the root stack — not here.
 */
export default function StudioStackLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface.base },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="ai" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="shop" />
    </Stack>
  );
}
