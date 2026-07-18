import { createContext, useContext } from "react";
import { router } from "expo-router";

import { STUDIO_SECTIONS, type StudioSection } from "@/lib/nav";

/**
 * In-place Studio segment navigation.
 *
 * The Studio tab is a SINGLE screen (components/studio/StudioScreen.tsx) whose
 * segmented bar swaps the body below it in place — no stack push, no slide.
 * Cross-links buried inside a section ("Open bookings", "Your AI staff area",
 * etc.) switch the active segment through this context instead of navigating.
 *
 * When a component that uses `useStudioNav` is rendered OUTSIDE the Studio
 * screen (e.g. a shared card reused elsewhere), there's no provider, so it
 * falls back to a normal route push into the Studio tab — the deep-link entry
 * files resolve `/studio/<section>` to the same screen at that segment.
 */
const ROUTE_BY_SECTION: Record<StudioSection, string> = Object.fromEntries(
  STUDIO_SECTIONS.map((s) => [s.value, s.route]),
) as Record<StudioSection, string>;

const StudioNavContext = createContext<((section: StudioSection) => void) | null>(null);

export const StudioNavProvider = StudioNavContext.Provider;

/**
 * Returns a function that switches the active Studio segment in place when
 * called inside the Studio screen, or pushes the section's route when called
 * from outside it.
 */
export function useStudioNav(): (section: StudioSection) => void {
  const switchInPlace = useContext(StudioNavContext);
  return (section: StudioSection) => {
    if (switchInPlace) switchInPlace(section);
    else router.push(ROUTE_BY_SECTION[section] as never);
  };
}
