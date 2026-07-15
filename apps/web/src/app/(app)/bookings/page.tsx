import type { Metadata } from "next";
import { PlaceholderScreen } from "@/components/placeholder-screen";

export const metadata: Metadata = { title: "Bookings" };

export default function BookingsPage() {
  return (
    <PlaceholderScreen
      eyebrow="Pipeline"
      title="Bookings"
      subtitle="Every request from first inquiry to healed and rebooked."
      icon="calendar"
      emptyTitle="No bookings yet"
      description="Inquiries, consults, deposits and multi-session work will move through here — with reminders and aftercare handled for you."
      actionLabel="Add a booking"
      actionHref="/bookings"
    />
  );
}
