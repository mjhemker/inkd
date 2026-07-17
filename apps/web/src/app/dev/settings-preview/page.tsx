"use client";

/**
 * Dev-only preview harness for the Settings page (layout shell) and the
 * Dashboard, rendered against an in-memory mock Supabase client (see
 * mockSettingsClient.ts) because this sandbox's egress policy blocks the
 * live Supabase project for outbound browser requests. Renders the REAL
 * `SettingsView` / `DashboardPreview` components inside the REAL `AppShell`
 * chrome with seeded fixtures, so the settings-layout-shell fixes (tab-rail
 * scrollbar, full-width content) and the dashboard-stats fixes can be
 * screenshotted end to end.
 *
 * `?screen=dashboard` renders the dashboard instead of settings.
 * Never linked from product nav. Not for production use.
 */
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { InkdProvider } from "@inkd/core/hooks";
import { ToastProvider } from "@inkd/ui/web";
import { AppShell } from "@/components/app-shell";
import { DashboardPreview } from "@/components/dashboard-preview";
import { SettingsView } from "../../(app)/settings/settings-view";
import { createMockSettingsClient } from "./mockSettingsClient";
import { PROFILE_ID, seedTables } from "./seed";

const mockClient = createMockSettingsClient({ profileId: PROFILE_ID, tables: seedTables });

function SettingsPreviewInner() {
  const params = useSearchParams();
  const screen = params.get("screen") === "dashboard" ? "dashboard" : "settings";

  return (
    <InkdProvider client={mockClient}>
      <ToastProvider>
        <AppShell
          currentPath={screen === "dashboard" ? "/dashboard" : "/settings"}
          title={screen === "dashboard" ? "Dashboard" : "Settings"}
          forceArtistNav
          attention={{ bookings: 2, messages: 3, aiStaff: 4, studio: 6 }}
        >
          {screen === "dashboard" ? <DashboardPreview /> : <SettingsView />}
        </AppShell>
      </ToastProvider>
    </InkdProvider>
  );
}

export default function SettingsPreviewPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPreviewInner />
    </Suspense>
  );
}
