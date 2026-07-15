import { View } from "react-native";
import { Icon, cx } from "@inkd/ui/native";

// A small set of tasteful near-black / deep-violet tones — no CSS gradients on
// RN, so a missing-artwork card gets a deterministic solid tone (picked from
// the id) plus a thin accent bar, rather than a flat empty box.
const TONES = ["bg-primary-950", "bg-neutral-900", "bg-primary-900", "bg-neutral-800"] as const;

function toneForId(id: string): (typeof TONES)[number] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return TONES[hash % TONES.length]!;
}

export interface ArtworkPlaceholderProps {
  id: string;
  className?: string;
}

/** Deterministic placeholder for a feed card with no image. */
export function ArtworkPlaceholder({ id, className }: ArtworkPlaceholderProps) {
  return (
    <View className={cx("items-center justify-center overflow-hidden", toneForId(id), className)}>
      <View className="absolute inset-x-0 top-0 h-1 bg-brand" />
      <Icon name="image" size={28} color="#52525B" />
    </View>
  );
}
