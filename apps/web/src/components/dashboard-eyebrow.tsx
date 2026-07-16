"use client";

import { Eyebrow } from "@inkd/ui/web";
import { useCurrentProfile } from "@inkd/core/hooks";

/**
 * Dashboard header eyebrow — "Studio · {artist name}" from the signed-in
 * profile, never a hardcoded persona. `fallbackName` is used only by the
 * provider-free /dev/shell preview (where there is no session).
 */
export function DashboardEyebrow({ fallbackName }: { fallbackName?: string }) {
  const { data: profile } = useCurrentProfile();
  const name =
    profile?.display_name || profile?.handle || fallbackName || "Your studio";
  return <Eyebrow>Studio · {name}</Eyebrow>;
}
