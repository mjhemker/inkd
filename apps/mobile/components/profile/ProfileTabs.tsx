import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, LayoutChangeEvent, Pressable, Text, View } from "react-native";
import { cx } from "@inkd/ui/native";

import { useReducedMotion } from "@/lib/useReducedMotion";

export interface ProfileTabItem {
  value: string;
  label: string;
}

/**
 * The Portfolio · Posts · Flash tab bar on the Profile screen, with a sliding
 * active indicator that glides under the selected tab. Equal-width tabs, so the
 * indicator is `1/n` of the measured track and translates on the native driver
 * (transform only → 60fps). Reduced-motion collapses the glide to an instant
 * jump.
 */
export function ProfileTabBar({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (value: string) => void;
  items: ProfileTabItem[];
}) {
  const reduced = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    items.findIndex((i) => i.value === value),
  );
  const n = items.length;
  const segWidth = trackWidth > 0 ? trackWidth / n : 0;

  // Animated position of the indicator, in "tab index" units (0..n-1); scaled
  // to px via segWidth so a track relayout doesn't need a re-animation.
  const pos = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    if (reduced) {
      pos.setValue(activeIndex);
      return;
    }
    Animated.timing(pos, {
      toValue: activeIndex,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, reduced, pos]);

  const translateX = pos.interpolate({
    inputRange: items.map((_, i) => i),
    outputRange: items.map((_, i) => i * segWidth),
    extrapolate: "clamp",
  });

  return (
    <View
      className="relative rounded-lg border border-border-subtle bg-surface-raised p-1"
      onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width - 8)}
    >
      {/* Sliding active plate — sits behind the labels. Zine ink-inversion: the
          active plate is solid INK (off-white at night / black in daylight), not
          violet; the glide animation is unchanged. */}
      {segWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{ width: segWidth, transform: [{ translateX }] }}
          className="absolute bottom-1 left-1 top-1 rounded-sm bg-surface-inverse"
        />
      ) : null}
      <View className="flex-row">
        {items.map((item) => {
          const active = item.value === value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (item.value !== value) onChange(item.value);
              }}
              className="min-h-10 flex-1 items-center justify-center rounded-md px-3 py-2"
            >
              <Text
                className={cx(
                  "text-sm",
                  active ? "font-sans-bold text-content-inverse" : "font-sans-semibold text-content-secondary",
                )}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Gently fades + slides the active panel in whenever `activeKey` changes, so
 * the Profile tab panels transition smoothly instead of snapping. The parent
 * swaps `children` to the new panel on tab change; we re-run a short enter
 * animation (opacity + a small upward slide) on the native driver → 60fps.
 * Reduced-motion renders instantly (opacity pinned to 1).
 */
export function AnimatedTabPanel({
  activeKey,
  children,
}: {
  activeKey: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeKey, reduced, anim]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}
