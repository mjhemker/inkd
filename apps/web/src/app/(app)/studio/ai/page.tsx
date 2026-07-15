import type { Metadata } from "next";
import { Suspense } from "react";
import { AiStaffView } from "@/components/ai-staff/AiStaffView";

export const metadata: Metadata = { title: "AI staff" };

export default function AiStaffPage() {
  // useSearchParams (?tab / ?action deep links) needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <AiStaffView />
    </Suspense>
  );
}
