import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { cssInterop } from "nativewind";
import type { ComponentProps } from "react";

// Feather (react-native-vector-icons) isn't a core RN component, so NativeWind
// doesn't auto-map `className` on it. Register the mapping explicitly so
// consumers can still pass className the same way they do on View/Text.
const StyledFeather = cssInterop(Feather, { className: "style" });
// A couple of glyphs read better from MaterialCommunityIcons (see mcMap below).
const StyledMaterial = cssInterop(MaterialCommunityIcons, { className: "style" });

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
  | "alert-triangle"
  | "sun"
  | "moon"
  | "monitor";

type FeatherName = ComponentProps<typeof Feather>["name"];
type MaterialName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/**
 * Maps our shared icon vocabulary to the closest Feather glyph. Most names
 * match Feather 1:1; the exceptions are documented below.
 *  - "layout-grid" -> "grid" (Feather has no "layout-grid").
 *  - "monitor" -> "monitor" (theme "System" affordance).
 *  - "sparkles" is NOT here — it renders from MaterialCommunityIcons (mcMap)
 *    because Feather has no sparkle glyph and its old "zap" fallback read as a
 *    lightning/power bolt on the AI-staff surfaces, not "AI".
 */
const glyphMap: Record<Exclude<IconName, "sparkles">, FeatherName> = {
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
  menu: "menu",
  "credit-card": "credit-card",
  clock: "clock",
  shield: "shield",
  "trending-up": "trending-up",
  "alert-triangle": "alert-triangle",
  sun: "sun",
  moon: "moon",
  monitor: "monitor",
};

/**
 * Names better served by MaterialCommunityIcons than Feather.
 *  - "sparkles" -> "creation" — an actual sparkle cluster, matching the web
 *    custom sparkle. Replaces the old "zap" bolt on AI-staff surfaces.
 */
const mcMap: Partial<Record<IconName, MaterialName>> = {
  sparkles: "creation",
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
}

export function Icon({ name, size = 20, color = "#FAFAFA", className }: IconProps) {
  const material = mcMap[name];
  if (material) {
    return (
      <StyledMaterial
        name={material}
        size={size}
        color={color}
        className={className}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }
  const glyph = glyphMap[name as Exclude<IconName, "sparkles">] ?? "help-circle";
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
