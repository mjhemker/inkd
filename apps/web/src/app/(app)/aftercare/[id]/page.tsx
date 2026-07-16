"use client";

import { useParams } from "next/navigation";
import { AftercareCheckinScreen } from "@/components/aftercare/checkin-screen";

export default function AftercareCheckinPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return <AftercareCheckinScreen checkinId={id ?? ""} />;
}
