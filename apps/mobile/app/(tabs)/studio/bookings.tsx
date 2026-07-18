import { StudioScreen } from "@/components/studio/StudioScreen";

/**
 * Deep-link entry for /studio/bookings → the single Studio screen at the
 * Bookings segment. Kept as a route so notifications and legacy links resolve;
 * in-app the segmented bar swaps to Bookings in place (no navigation).
 */
export default function StudioBookingsScreen() {
  return <StudioScreen initialSegment="bookings" />;
}
