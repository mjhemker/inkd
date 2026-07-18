import { useCallback, useRef, useState } from "react";
import {
  PanResponder,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { cx } from "../cx";
import { a11yPercent, sliderRatio } from "./sliderMath";

const THUMB_SIZE = 24;

export interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  className?: string;
}

/**
 * Self-contained drag slider built on PanResponder + a measured track width —
 * no external slider dependency. Track is `bg-surface-overlay`, the filled
 * portion `bg-brand`, and the thumb a 24px `bg-neutral-50` circle.
 */
export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  label,
  className,
}: SliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);

  const handleLayout = useCallback((evt: LayoutChangeEvent) => {
    setTrackWidth(evt.nativeEvent.layout.width);
  }, []);

  const clampAndStep = useCallback(
    (raw: number) => {
      const clamped = Math.min(Math.max(raw, min), max);
      const steps = Math.round((clamped - min) / step);
      const stepped = min + steps * step;
      return Math.min(Math.max(stepped, min), max);
    },
    [min, max, step],
  );

  const handleTouch = useCallback(
    (evt: GestureResponderEvent) => {
      if (trackWidth <= 0) return;
      const x = evt.nativeEvent.locationX;
      const ratio = Math.min(Math.max(x / trackWidth, 0), 1);
      const raw = min + ratio * (max - min);
      onValueChange(clampAndStep(raw));
    },
    [trackWidth, min, max, onValueChange, clampAndStep],
  );

  const handleTouchRef = useRef(handleTouch);
  handleTouchRef.current = handleTouch;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => handleTouchRef.current(evt),
      onPanResponderMove: (evt) => handleTouchRef.current(evt),
    }),
  ).current;

  const ratio = sliderRatio(value, min, max);
  const thumbLeft =
    trackWidth > 0 ? Math.min(Math.max(ratio * trackWidth - THUMB_SIZE / 2, -THUMB_SIZE / 2), trackWidth - THUMB_SIZE / 2) : 0;

  return (
    <View className={cx("gap-2", disabled && "opacity-50", className)}>
      {label ? <Text className="text-sm text-content-secondary">{label}</Text> : null}
      <View
        onLayout={handleLayout}
        pointerEvents={disabled ? "none" : "auto"}
        accessibilityRole="adjustable"
        // Report a whole-number percent (min:0/max:100), never the raw domain
        // value — Fabric types accessibilityValue as int and a fractional
        // `now` (e.g. 0.15) crashes createNode. See sliderMath.ts.
        accessibilityValue={{ min: 0, max: 100, now: a11yPercent(value, min, max) }}
        className="h-6 justify-center"
        {...panResponder.panHandlers}
      >
        <View className="h-1.5 w-full overflow-hidden rounded-full bg-surface-overlay">
          <View className="h-full rounded-full bg-brand" style={{ width: `${ratio * 100}%` }} />
        </View>
        <View
          className="absolute h-6 w-6 rounded-full bg-neutral-50"
          style={{ left: thumbLeft }}
        />
      </View>
    </View>
  );
}
