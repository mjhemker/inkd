import { Pressable } from "react-native";
import { router } from "expo-router";
import { Icon, cx } from "@inkd/ui/native";
import { useTheme } from "@/providers/theme";

export interface BackButtonProps {
  /**
   * Where to go when there's nothing to pop (screen opened via deep link /
   * notification). Defaults to the app root so a back button is never a no-op.
   */
  fallback?: string;
  /**
   * Replace the default pop/fallback behavior entirely — e.g. a multi-step flow
   * that wants its first-step Back to exit rather than navigate a screen.
   */
  onPress?: () => void;
  accessibilityLabel?: string;
  className?: string;
}

/**
 * The single mobile back affordance: a top-left, obviously-tappable chevron in a
 * bordered, raised 40x40 touch target (theme-aware). Pops navigation history
 * when it can, otherwise routes to `fallback`. Use this everywhere a screen
 * needs a back control (booking flow, waiver, waitlist, search, artist profile,
 * shop, notifications, try-on, aftercare, …) so the gesture is consistent.
 *
 * Not for the Studio area (owns its own header) or the bottom tab bar.
 */
export function BackButton({
  fallback = "/(tabs)",
  onPress,
  accessibilityLabel = "Back",
  className,
}: BackButtonProps) {
  const { colors } = useTheme();

  function handlePress() {
    if (onPress) {
      onPress();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.push(fallback as never);
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      className={cx(
        "h-10 w-10 items-center justify-center self-start rounded-lg border border-border-subtle bg-surface-raised active:opacity-80",
        className,
      )}
    >
      <Icon name="chevron-left" size={20} color={colors.text.primary} />
    </Pressable>
  );
}
