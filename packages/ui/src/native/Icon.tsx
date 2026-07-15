import { Feather } from "@expo/vector-icons";
import { cssInterop } from "nativewind";
import type { ComponentProps } from "react";

// Feather (react-native-vector-icons) isn't a core RN component, so NativeWind
// doesn't auto-map `className` on it. Register the mapping explicitly so
// consumers can still pass className the same way they do on View/Text.
const StyledFeather = cssInterop(Feather, { className: "style" });

/**
 * Shared icon name vocabulary — MUST stay identical to the web `IconName`
 * union (packages/ui/src/web/Icon.tsx) so shells can pass the same name to
 * either platform's <Icon />.
 */
export type IconName =
  | "home"
  | "compass"
  | "calendar"
  | "message-circle"
  | "user"
  | "layout-grid"
  | "settings"
  | "search"
  | "bell"
  | "plus"
  | "check"
  | "x"
  | "chevron-down"
  | "chevron-right"
  | "chevron-left"
  | "arrow-right"
  | "map-pin"
  | "star"
  | "image"
  | "sparkles"
  | "menu"
  | "credit-card"
  | "clock"
  | "shield"
  | "trending-up"
  | "alert-triangle";

type FeatherName = ComponentProps<typeof Feather>["name"];

/**
 * Maps our shared icon vocabulary to the closest Feather glyph. Most names
 * match Feather 1:1; the exceptions are documented below.
 *  - "layout-grid" -> "grid" (Feather has no "layout-grid").
 *  - "sparkles" -> "zap" (Feather has no sparkles/stars-cluster glyph; "zap"
 *    reads closest to an "AI / generate" affordance).
 */
const glyphMap: Record<IconName, FeatherName> = {
  home: "home",
  compass: "compass",
  calendar: "calendar",
  "message-circle": "message-circle",
  user: "user",
  "layout-grid": "grid",
  settings: "settings",
  search: "search",
  bell: "bell",
  plus: "plus",
  check: "check",
  x: "x",
  "chevron-down": "chevron-down",
  "chevron-right": "chevron-right",
  "chevron-left": "chevron-left",
  "arrow-right": "arrow-right",
  "map-pin": "map-pin",
  star: "star",
  image: "image",
  sparkles: "zap",
  menu: "menu",
  "credit-card": "credit-card",
  clock: "clock",
  shield: "shield",
  "trending-up": "trending-up",
  "alert-triangle": "alert-triangle",
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
}

export function Icon({ name, size = 20, color = "#FAFAFA", className }: IconProps) {
  const glyph = glyphMap[name] ?? "help-circle";
  return (
    <StyledFeather
      name={glyph}
      size={size}
      color={color}
      className={className}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
