/**
 * Two inline glyphs the shared @inkd/ui Icon set doesn't ship (heart, bookmark)
 * — the like + save affordances. Kept local so we consume the design system
 * without editing it. Stroke language matches the lucide-style Icon set
 * (24-grid, 1.75 stroke, currentColor); `filled` swaps to a solid fill for the
 * active/pressed state.
 */
export type FeedGlyphName = "heart" | "bookmark";

export interface FeedGlyphProps {
  name: FeedGlyphName;
  size?: number;
  filled?: boolean;
  className?: string;
}

const PATHS: Record<FeedGlyphName, string> = {
  heart:
    "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z",
  bookmark: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
};

export function FeedGlyph({ name, size = 20, filled = false, className }: FeedGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
