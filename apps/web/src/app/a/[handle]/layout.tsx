import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

/**
 * Artist public profile layout — wraps with AppShell so logged-in users retain
 * the left navigation while browsing other artists' portfolios. The shell
 * gracefully degrades for unauthenticated visitors (no session = minimal nav).
 */
export default function ArtistProfileLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
