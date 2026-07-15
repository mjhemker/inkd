"use client";

import { useParams } from "next/navigation";
import { BookingDetail } from "@/components/bookings/booking-detail";

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return <BookingDetail bookingId={id ?? ""} />;
}
