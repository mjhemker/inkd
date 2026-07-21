import { useMemo } from "react";
import { useArtistStyles, useStyles, type Style } from "@inkd/core";

import type { StyleOption } from "./StyleSuggestInput";

/**
 * Builds the ordered style options for an Add flow's styles step: the artist's
 * profile styles and any recently-used slugs are flagged `suggested` (surfaced
 * first), followed by the rest of the taxonomy.
 *
 * `keyBy` chooses the option key that matches how the target content persists
 * styles — portfolio pieces store style slugs in `style_tags`; posts reference
 * taxonomy rows by id via `post_styles`.
 */
export function useStyleOptions({
  artistId,
  keyBy,
  recentSlugs = [],
}: {
  artistId: string;
  keyBy: "slug" | "id";
  recentSlugs?: string[];
}): { options: StyleOption[]; isLoading: boolean } {
  const { data: allStyles, isLoading: allLoading } = useStyles();
  const { data: profileStyles, isLoading: profileLoading } = useArtistStyles(artistId);

  const options = useMemo<StyleOption[]>(() => {
    const all = allStyles ?? [];
    const profileIds = new Set((profileStyles ?? []).map((s) => s.id));
    const recent = new Set(recentSlugs);
    const keyOf = (s: Style) => (keyBy === "slug" ? s.slug : s.id);

    const scored = all.map((s) => {
      const suggested = profileIds.has(s.id) || recent.has(s.slug);
      return { option: { key: keyOf(s), label: s.name, suggested }, suggested };
    });
    // Suggested first, otherwise keep taxonomy order (already sort_order).
    return scored
      .sort((a, b) => Number(b.suggested) - Number(a.suggested))
      .map((s) => s.option);
  }, [allStyles, profileStyles, recentSlugs, keyBy]);

  return { options, isLoading: allLoading || profileLoading };
}
