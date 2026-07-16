import { Text, View } from "react-native";

/**
 * INKD brand mark (native).
 *
 * The same monogram as the web `LogoMark` — a slab capital "I" with an ember
 * flash-diamond stamped on its stem — composed from plain Views so it needs no
 * SVG dependency. Geometry mirrors the 48×48 art box used for the favicons and
 * app icons. The violet plate stays brand-constant across Dark / Light.
 */
export interface LogoMarkProps {
  size?: number;
}

export function LogoMark({ size = 32 }: LogoMarkProps) {
  const u = size / 48; // one art unit
  const gem = 6.8 * u; // rotated-square side ≈ the 9.6-unit diamond diagonal

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10 * u,
        backgroundColor: "#7C3AED",
      }}
    >
      {/* slab "I" */}
      <View
        style={{
          position: "absolute",
          left: 14 * u,
          top: 12 * u,
          width: 20 * u,
          height: 5 * u,
          backgroundColor: "#FFFFFF",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 21 * u,
          top: 12 * u,
          width: 6 * u,
          height: 24 * u,
          backgroundColor: "#FFFFFF",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 14 * u,
          top: 31 * u,
          width: 20 * u,
          height: 5 * u,
          backgroundColor: "#FFFFFF",
        }}
      />
      {/* ember flash-diamond stamp */}
      <View
        style={{
          position: "absolute",
          left: (size - gem) / 2,
          top: (size - gem) / 2,
          width: gem,
          height: gem,
          backgroundColor: "#E8A15C",
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

export interface LogoProps extends LogoMarkProps {
  /** Show the "INKD" wordmark beside the mark (default true). */
  wordmark?: boolean;
}

/** The mark + "INKD" wordmark lockup in the display face. */
export function Logo({ size = 32, wordmark = true }: LogoProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <LogoMark size={size} />
      {wordmark && (
        <Text className="font-display text-xl text-content-primary">INKD</Text>
      )}
    </View>
  );
}
