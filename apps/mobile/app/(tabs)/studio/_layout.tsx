import { Stack } from "expo-router";

import { useTheme } from "@/providers/theme";

/**
 * Nested stack for the Studio tab. The artist ops surfaces — dashboard
 * (index), bookings, AI staff, settings, and the shop dashboard — all live
 * here so the bottom tab bar (owned by the outer (tabs)/_layout) stays visible
 * on every one of them. The segmented header (StudioSegments) switches between
 * the four primary sections via `router.replace`; `shop` is a drill-in.
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
