import type { ReactNode } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { cx } from "../cx";

export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
  /** Optional trailing adornment (e.g. an attention badge) rendered after the
   * label. Additive — omit for a plain tab. */
  badge?: ReactNode;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  items: TabItem[];
  className?: string;
}

export function Tabs({ value, onValueChange, items, className }: TabsProps) {
  return (
    // Segmented control on a flat raised track (placard language). Zine rule:
    // the active tab INVERTS to solid ink (surface-inverse / content-inverse) —
    // off-white w/ black text at night, black w/ white text in daylight — NOT a
    // violet-tinted tab. Inactive tabs stay flat. Mirrors the web Tabs. The
    // optional `badge` slot (red count pill) is preserved.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={cx("flex-none", className)}
      contentContainerClassName="flex-row items-center gap-1 rounded-lg border border-border-subtle bg-surface-raised p-1"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onValueChange(item.value)}
            className={cx(
              "min-h-9 flex-row items-center gap-1.5 rounded-sm px-3.5 py-2",
              active ? "bg-surface-inverse" : "bg-transparent",
            )}
          >
            {item.icon}
            <Text
              className={cx(
                "font-sans-semibold text-sm",
                active ? "text-content-inverse" : "text-content-secondary",
              )}
            >
              {item.label}
            </Text>
            {item.badge}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
