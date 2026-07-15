import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { cx } from "../cx";

export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  items: TabItem[];
  className?: string;
}

export function Tabs({ value, onValueChange, items, className }: TabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={cx("flex-none border-b border-border-subtle", className)}
    >
      <View className="flex-row">
        {items.map((item) => {
          const active = item.value === value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onValueChange(item.value)}
              className={cx(
                "min-h-11 flex-row items-center gap-1.5 border-b-2 px-4",
                active ? "border-brand" : "border-transparent",
              )}
            >
              {item.icon}
              <Text
                className={cx(
                  "font-sans-medium text-sm",
                  active ? "text-content-primary" : "text-content-secondary",
                )}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
