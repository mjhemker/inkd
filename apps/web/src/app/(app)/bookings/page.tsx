import type { Metadata } from "next";
import { BookingsHub } from "@/components/bookings/bookings-hub";

export const metadata: Metadata = { title: "Bookings" };

export default function BookingsPage() {
  return <BookingsHub />;
}
