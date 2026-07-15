import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { Eyebrow } from "@inkd/ui/native";

export interface ScreenHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Extra content rendered above the eyebrow, e.g. the Home brand row. */
  before?: ReactNode;
  /** Optional trailing control pinned top-right of the title row (e.g. the
   * notification bell on the Profile tab). Keeps the eyebrow/title/subtitle
   * stack untouched for every screen that doesn't pass one. */
  action?: ReactNode;
}

/**
 * Shared screen header used across tabs + standalone screens: an optional
 * leading block, the mono micro-label eyebrow, a big display title, and an
 * optional muted one-line subtitle.
 */
export function ScreenHeader({ eyebrow, title, subtitle, before, action }: ScreenHeaderProps) {
  const content = (
    <View className="gap-3">
      {before}
      <Eyebrow>{eyebrow}</Eyebrow>
      <Text className="font-display text-3xl text-content-primary">{title}</Text>
      {subtitle ? (
        <Text className="text-sm text-content-secondary">{subtitle}</Text>
      ) : null}
    </View>
  );

  if (!action) return content;

  return (
    <View className="flex-row items-start justify-between gap-3">
      <View className="flex-1">{content}</View>
      {action}
    </View>
  );
}
