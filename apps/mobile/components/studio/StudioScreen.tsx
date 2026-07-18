import { useState } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ToastProvider } from "@inkd/ui/native";
import { useCurrentProfile } from "@inkd/core";

import { ScreenHeader } from "@/components/ScreenHeader";
import { ArtistOnly } from "@/components/ArtistOnly";
import { MessagesHeaderButton } from "@/components/messages/MessagesHeaderButton";
import { StudioSegments } from "@/components/studio/StudioSegments";
import { StudioNavProvider } from "@/components/studio/StudioNav";
import { DashboardBody } from "@/components/studio/DashboardBody";
import { BookingsBody } from "@/components/studio/BookingsBody";
import { AiStaffBody } from "@/components/studio/AiStaffBody";
import { SettingsBody } from "@/components/studio/SettingsBody";
import type { StudioSection } from "@/lib/nav";

/**
 * The Studio tab — a SINGLE screen. The segmented bar (Dashboard | Bookings |
 * AI staff | Settings) swaps the body below it IN PLACE via local state: no
 * stack push, no slide (founder spec). The bottom tab bar stays visible
 * throughout, and detail screens (booking detail, message thread, waivers,
 * shop drill-in) are still normal root/stack pushes layered ON TOP.
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

function StudioScreenInner({ initialSegment }: { initialSegment: StudioSection }) {
  const [segment, setSegment] = useState<StudioSection>(initialSegment);

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-8">
        <StudioHeader segment={segment} />
        <StudioSegments active={segment} onSelect={setSegment} />
        <StudioNavProvider value={setSegment}>
          {segment === "dashboard" && <DashboardBody />}
          {segment === "bookings" && <BookingsBody />}
          {segment === "ai" && <AiStaffBody />}
          {segment === "settings" && <SettingsBody />}
        </StudioNavProvider>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Per-segment header. The Dashboard header carries the artist's inbox — a
 * Messages icon (top-right) with unread badge, since artists have no Messages
 * bottom tab. Bookings shows no header (the segmented bar leads). */
function StudioHeader({ segment }: { segment: StudioSection }) {
  const { data: profile } = useCurrentProfile();

  if (segment === "bookings") return null;

  if (segment === "dashboard") {
    const displayName = profile?.display_name ?? profile?.handle ?? "your studio";
    return (
      <ScreenHeader
        eyebrow={`STUDIO OPS · ${displayName.toUpperCase()}`}
        title="Dashboard"
        subtitle="Your operational overview — bookings, revenue, and requests at a glance."
        action={<MessagesHeaderButton />}
      />
    );
  }

  if (segment === "ai") {
    return (
      <ScreenHeader
        eyebrow="Studio · AI staff"
        title="AI staff"
        subtitle="Your Front Desk and Booking Manager, working from your published info. Everything they do is here for you to see."
      />
    );
  }

  // settings
  return (
    <ScreenHeader
      eyebrow="Settings"
      title="Studio settings"
      subtitle="Manage everything clients see and how your books run."
    />
  );
}
