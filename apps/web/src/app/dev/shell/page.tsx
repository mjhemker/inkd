import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { DashboardPreview } from "@/components/dashboard-preview";

export const metadata: Metadata = { title: "Shell preview", robots: { index: false } };

/**
 * Unauthenticated preview of the authenticated shell (the real /dashboard sits
 * behind auth middleware). Renders the shell chrome with the Dashboard active so
 * the navigation and layout can be reviewed. Dev-only.
 */
export default function ShellPreviewPage() {
  return (
    <AppShell currentPath="/dashboard" title="Dashboard">
      <DashboardPreview />
    </AppShell>
  );
}
