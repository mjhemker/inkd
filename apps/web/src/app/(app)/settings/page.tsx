import type { Metadata } from "next";
import { PlaceholderScreen } from "@/components/placeholder-screen";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PlaceholderScreen
      eyebrow="Settings"
      title="Settings"
      subtitle="Studio details, availability, services, payouts and your AI staff."
      icon="settings"
      emptyTitle="Settings live here"
      description="Manage locations and hours, services and rates, Stripe payouts, waivers, and how much your AI staff can do on their own."
    />
  );
}
