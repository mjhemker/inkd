import { StudioScreen } from "@/components/studio/StudioScreen";

/**
 * Studio tab landing (/studio) → the single Studio screen at the Dashboard
 * segment. The segmented bar swaps Bookings / AI staff / Settings in place;
 * see components/studio/StudioScreen.tsx.
 */
export default function StudioDashboardScreen() {
  return <StudioScreen initialSegment="dashboard" />;
}
