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

const THUMB_SIZE = 28;

export interface RangeSliderProps {
  /** Current [low, high] value. Kept low <= high by the component. */
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  formatValue?: (v: number) => string;
  className?: string;
}

/**
 * Dual-thumb range slider on PanResponder + a measured track width — the
 * two-thumb sibling of Slider. The grabbed thumb is whichever is nearer the
 * touch; thumbs cannot cross. Track is `bg-surface-overlay`, the selected span
 * `bg-brand`, and each endpoint is a 28px theme-aware circular thumb (surface
 * fill + brand ring) with a pressed state.
 */
export function RangeSlider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  label,
  formatValue = (v) => String(v),
  className,
}: RangeSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [pressed, setPressed] = useState<"low" | "high" | null>(null);
  const activeThumb = useRef<"low" | "high" | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const widthRef = useRef(0);
  widthRef.current = trackWidth;

  const handleLayout = useCallback((evt: LayoutChangeEvent) => {
    setTrackWidth(evt.nativeEvent.layout.width);
  }, []);

  const clampAndStep = useCallback(
    (raw: number) => {
      const clamped = Math.min(Math.max(raw, min), max);
      const steps = Math.round((clamped - min) / step);
      return Math.min(Math.max(min + steps * step, min), max);
    },
    [min, max, step],
  );

  const valueAt = useCallback(
    (x: number) => {
      const w = widthRef.current;
      if (w <= 0) return min;
      const ratio = Math.min(Math.max(x / w, 0), 1);
      return clampAndStep(min + ratio * (max - min));
    },
    [clampAndStep, min, max],
  );

  const applyMove = useCallback(
    (v: number) => {
      const [low, high] = valueRef.current;
      if (activeThumb.current === "low") {
        onValueChange([Math.min(v, high), high]);
      } else if (activeThumb.current === "high") {
        onValueChange([low, Math.max(v, low)]);
      }
    },
    [onValueChange],
  );

  const onGrant = useCallback(
    (evt: GestureResponderEvent) => {
      const v = valueAt(evt.nativeEvent.locationX);
      const [low, high] = valueRef.current;
      // Grab the nearer thumb; on a tie (both thumbs together) pick by side.
      const dLow = Math.abs(v - low);
      const dHigh = Math.abs(v - high);
      activeThumb.current = dLow < dHigh || (dLow === dHigh && v <= low) ? "low" : "high";
      setPressed(activeThumb.current);
      applyMove(v);
    },
    [valueAt, applyMove],
  );

  const onMove = useCallback(
    (evt: GestureResponderEvent) => applyMove(valueAt(evt.nativeEvent.locationX)),
    [applyMove, valueAt],
  );

  const onGrantRef = useRef(onGrant);
  const onMoveRef = useRef(onMove);
  onGrantRef.current = onGrant;
  onMoveRef.current = onMove;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => onGrantRef.current(evt),
      onPanResponderMove: (evt) => onMoveRef.current(evt),
      onPanResponderRelease: () => {
        activeThumb.current = null;
        setPressed(null);
      },
      onPanResponderTerminate: () => {
        activeThumb.current = null;
        setPressed(null);
      },
    }),
  ).current;

  const [low, high] = value;
  const lowRatio = sliderRatio(low, min, max);
  const highRatio = sliderRatio(high, min, max);
  const thumbLeft = (ratio: number) =>
    trackWidth > 0
      ? Math.min(Math.max(ratio * trackWidth - THUMB_SIZE / 2, -THUMB_SIZE / 2), trackWidth - THUMB_SIZE / 2)
      : 0;

  return (
    <View className={cx("gap-2", disabled && "opacity-50", className)}>
      {label ? (
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-content-secondary">{label}</Text>
          <Text className="font-mono text-xs text-content-muted">
            {formatValue(low)} – {formatValue(high)}
          </Text>
        </View>
      ) : null}
      <View
        onLayout={handleLayout}
        pointerEvents={disabled ? "none" : "auto"}
        accessibilityRole="adjustable"
        // Whole-number percent (min:0/max:100), never the raw domain value —
        // Fabric types accessibilityValue as int; a fractional `now` crashes
        // createNode. See sliderMath.ts.
        accessibilityValue={{ min: 0, max: 100, now: a11yPercent(low, min, max) }}
        className="h-7 justify-center"
        {...panResponder.panHandlers}
      >
        <View className="h-1.5 w-full overflow-hidden rounded-full bg-surface-overlay">
          <View
            className="absolute h-1.5 rounded-full bg-brand"
            style={{ left: `${lowRatio * 100}%`, width: `${Math.max(0, (highRatio - lowRatio) * 100)}%` }}
          />
        </View>
        <Thumb left={thumbLeft(lowRatio)} pressed={pressed === "low"} />
        <Thumb left={thumbLeft(highRatio)} pressed={pressed === "high"} />
      </View>
    </View>
  );
}

/**
 * A single endpoint handle — a clear circular thumb (theme-aware: surface fill,
 * brand ring) sized to a 28px touch target, with a pressed state (scale + a
 * soft brand halo) so it's obvious which thumb you're dragging.
 */
function Thumb({ left, pressed }: { left: number; pressed: boolean }) {
  return (
    <View
      className="absolute rounded-full border-2 border-brand bg-surface-raised"
      style={{
        left,
        height: THUMB_SIZE,
        width: THUMB_SIZE,
        transform: [{ scale: pressed ? 1.12 : 1 }],
        // Soft depth so the handle reads on both themes; the halo strengthens
        // while pressed.
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: pressed ? 0.3 : 0.22,
        shadowRadius: pressed ? 5 : 2,
        elevation: pressed ? 5 : 2,
      }}
    />
  );
}
