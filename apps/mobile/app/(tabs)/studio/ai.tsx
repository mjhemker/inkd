import { StudioScreen } from "@/components/studio/StudioScreen";

/**
 * Deep-link entry for /studio/ai (and /studio/ai?tab=…&action=… from
 * notifications and message-thread provenance) → the single Studio screen at
 * the AI staff segment. Route params flow into AiStaffBody via
 * useLocalSearchParams. In-app the segmented bar swaps here in place.
 */
export default function AiStaffScreen() {
  return <StudioScreen initialSegment="ai" />;
}
