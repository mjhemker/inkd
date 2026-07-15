"use client";

import { useParams } from "next/navigation";
import { RequestDetail } from "@/components/bookings/request-detail";

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return <RequestDetail requestId={id ?? ""} />;
}
