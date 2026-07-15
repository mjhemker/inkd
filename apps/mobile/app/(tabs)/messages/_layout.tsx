import { Stack } from "expo-router";

/**
 * Nested stack for the Messages tab: list → chat → the `/messages/new`
 * find-or-create resolver. The outer `(tabs)` layout (owned by the design
 * agent) is untouched — this only swaps the content within the "Messages"
 * tab slot.
 */
export default function MessagesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0A0A0B" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[threadId]" />
      <Stack.Screen name="new" options={{ presentation: "modal" }} />
    </Stack>
  );
}
