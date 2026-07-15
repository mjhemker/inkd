import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { Eyebrow } from "@inkd/ui/native";

export interface ScreenHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Extra content rendered above the eyebrow, e.g. the Home brand row. */
  before?: ReactNode;
}

/**
 * Shared screen header used across tabs + standalone screens: an optional
 * leading block, the mono micro-label eyebrow, a big display title, and an
 * optional muted one-line subtitle.
 */
export function ScreenHeader({ eyebrow, title, subtitle, before }: ScreenHeaderProps) {
  return (
    <View className="gap-3">
      {before}
      <Eyebrow>{eyebrow}</Eyebrow>
      <Text className="font-display text-3xl text-content-primary">{title}</Text>
      {subtitle ? (
        <Text className="text-sm text-content-secondary">{subtitle}</Text>
      ) : null}
    </View>
  );
}
