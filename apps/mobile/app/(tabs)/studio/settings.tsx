import { StudioScreen } from "@/components/studio/StudioScreen";

/**
 * Deep-link entry for /studio/settings (and /studio/settings?tab=… from
 * notifications / cross-links) → the single Studio screen at the Settings
 * segment. The `?tab=` param flows into SettingsBody via useLocalSearchParams.
 * In-app the segmented bar swaps here in place.
 */
export default function SettingsScreen() {
  return <StudioScreen initialSegment="settings" />;
}
