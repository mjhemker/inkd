import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { DashboardPreview } from "@/components/dashboard-preview";

export const metadata: Metadata = { title: "Shell preview", robots: { index: false } };

/**
 * Unauthenticated preview of the authenticated shell (the real /dashboard sits
 * behind auth middleware). Renders the shell chrome with the Dashboard active so
 * the navigation and layout can be reviewed. Dev-only.
 */
export default async function ShellPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  const isClient = role === "client";

  if (isClient) {
    // Client view: no Studio nav group, generic client identity, feed active.
    return (
      <AppShell
        currentPath="/feed"
        title="Home"
        forceArtistNav={false}
        identity={{ name: "Casey Client", handle: "casey.client", avatarUrl: null }}
      >
        <div className="p-4 text-content-secondary">
          Client shell preview — the Studio nav group is hidden for clients.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      currentPath="/dashboard"
      title="Dashboard"
      forceArtistNav
      identity={{ name: "Jayden Cole", handle: "jayden.ink", avatarUrl: null }}
    >
      <DashboardPreview liveAiStaff={false} />
    </AppShell>
  );
}
