import type { Metadata } from "next";
import { NotificationsHub } from "@/components/notifications/notifications-hub";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return <NotificationsHub />;
}
