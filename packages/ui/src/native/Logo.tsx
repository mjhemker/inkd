import { Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import Svg, { Path } from "react-native-svg";
import {
  COMPASS_DROP,
  COMPASS_POINTS,
  COMPASS_VIOLET,
  DROP_ON_DARK,
  DROP_ON_LIGHT,
  ON_BRAND_INK,
} from "../brand";

/**
 * INKD brand mark (native) — the ink-drop compass.
 *
 * The drop's tip is north; three violet points mark west / east / south. Shares
 * its geometry with the web `LogoMark` and the generated app icons via
 * `../brand`, so the three can never drift apart.
 *
 * Unlike the monogram this replaces, the mark carries no plate: it sits
 * directly on the surface, and its crescent is a hole rather than a white
 * shape, so switching theme only means flipping the drop's tone.
 * react-native-svg can't read NativeWind classes, so we resolve the active
 * scheme and pass a concrete colour (the same approach as `BodyMap`).
 */
export type LogoTone = "auto" | "on-brand";

export interface LogoMarkProps {
  size?: number;
  /**
   * `auto` (default) — drop in the active theme's ink, points in brand violet.
   * `on-brand` — the whole mark in the on-brand ink, for violet plates where
   * violet points would vanish into the background.
   */
  tone?: LogoTone;
}

function useMarkColors(tone: LogoTone) {
  const { colorScheme } = useColorScheme();
  if (tone === "on-brand") {
    return { drop: ON_BRAND_INK, point: ON_BRAND_INK };
  }
  return {
    drop: colorScheme === "light" ? DROP_ON_LIGHT : DROP_ON_DARK,
    point: COMPASS_VIOLET,
  };
}

export function LogoMark({ size = 32, tone = "auto" }: LogoMarkProps) {
  const { drop, point } = useMarkColors(tone);
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d={COMPASS_DROP} fill={drop} fillRule="evenodd" />
      {COMPASS_POINTS.map((d) => (
        <Path key={d} d={d} fill={point} />
      ))}
    </Svg>
  );
}

/**
 * The Daily Drop mark. The compass IS an ink drop, so the drop mark and the
 * brand mark are now one glyph — kept as its own export so the Daily Drop call
 * sites still read as deliberate rather than borrowing the brand mark.
 */
export const LogoDropMark = LogoMark;

export interface LogoProps extends LogoMarkProps {
  /** Show the "INKD" wordmark beside the mark (default true). */
  wordmark?: boolean;
}

/** The mark + "INKD" wordmark lockup in the display face. */
export function Logo({ size = 32, tone = "auto", wordmark = true }: LogoProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <LogoMark size={size} tone={tone} />
      {wordmark && (
        <Text className="font-display text-xl text-content-primary">INKD</Text>
      )}
    </View>
  );
}
