import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Eyebrow, ToastProvider } from "@inkd/ui/native";
import { useCurrentProfile } from "@inkd/core";

import { ArtistOnly } from "@/components/ArtistOnly";
import { StudioSegments } from "@/components/studio/StudioSegments";
import { StudioNavProvider } from "@/components/studio/StudioNav";
import { DashboardBody } from "@/components/studio/DashboardBody";
import { BookingsBody } from "@/components/studio/BookingsBody";
import { AiStaffBody } from "@/components/studio/AiStaffBody";
import { SettingsBody } from "@/components/studio/SettingsBody";
import { STUDIO_SECTIONS, type StudioSection } from "@/lib/nav";

/**
 * The Studio tab — a SINGLE screen. The segmented bar (Dashboard | Bookings |
 * AI staff | Settings) swaps the body below it IN PLACE via local state: no
 * stack push, no slide (founder spec). The bottom tab bar stays visible
 * throughout, and detail screens (booking detail, message thread, waivers,
 * shop drill-in) are still normal root/stack pushes layered ON TOP.
 *
 * HEADER (founder redesign) — top→down:
 *   1. eyebrow line  STUDIO OPS • {ARTIST NAME}  (mono micro-label)
 *   2. the segmented tab bar DIRECTLY under it (prominent — larger/bolder,
 *      strong active treatment; it carries the section label now)
 *   3. a one-line muted snippet for the active section (from STUDIO_SECTIONS)
 *   4. the section body
 * There is no big per-tab H1 title anymore — the tab bar is the label. The
 * messages inbox icon that briefly sat in this header is gone (Inbox is its
 * own bottom tab now).
 *
 * Deep links (/studio, /studio/bookings, /studio/ai, /studio/settings) resolve
 * through the thin entry files in app/(tabs)/studio/*, each of which mounts
 * this screen at the matching `initialSegment` — so a notification tap still
 * lands on the right section, and route params (?tab=, ?action=) flow into the
 * AI / Settings bodies via useLocalSearchParams.
 */
export function StudioScreen({ initialSegment }: { initialSegment: StudioSection }) {
  return (
    <ArtistOnly requireOnboarding>
      <ToastProvider>
        <StudioScreenInner initialSegment={initialSegment} />
      </ToastProvider>
    </ArtistOnly>
  );
}

const SNIPPET_BY_SECTION: Record<StudioSection, string> = Object.fromEntries(
  STUDIO_SECTIONS.map((s) => [s.value, s.snippet]),
) as Record<StudioSection, string>;

function StudioScreenInner({ initialSegment }: { initialSegment: StudioSection }) {
  const [segment, setSegment] = useState<StudioSection>(initialSegment);
  const { data: profile } = useCurrentProfile();
  const displayName = profile?.display_name ?? profile?.handle ?? "your studio";

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-5 px-6 py-8">
        {/* 1 — eyebrow */}
        <Eyebrow>{`STUDIO OPS • ${displayName.toUpperCase()}`}</Eyebrow>
        {/* 2 — prominent segmented bar (carries the section label) */}
        <StudioSegments active={segment} onSelect={setSegment} />
        {/* 3 — muted one-line snippet for the active section */}
        <Text className="text-sm text-content-secondary">{SNIPPET_BY_SECTION[segment]}</Text>
        {/* 4 — section body */}
        <StudioNavProvider value={setSegment}>
          <View className="gap-6">
            {segment === "dashboard" && <DashboardBody />}
            {segment === "bookings" && <BookingsBody />}
            {segment === "ai" && <AiStaffBody />}
            {segment === "settings" && <SettingsBody />}
          </View>
        </StudioNavProvider>
      </ScrollView>
    </SafeAreaView>
  );
}
