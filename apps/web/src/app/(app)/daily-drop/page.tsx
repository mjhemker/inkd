import type { Metadata } from "next";
import { DailyDropSurface } from "@/components/daily-drop/DailyDropSurface";

export const metadata: Metadata = { title: "Daily Drop" };

// The dedicated Daily Drop surface + the daily notification's deep-link target
// (action_url "/daily-drop"). Today's personalized pick + a recent-drops strip.
export default function DailyDropPage() {
  return <DailyDropSurface />;
}
