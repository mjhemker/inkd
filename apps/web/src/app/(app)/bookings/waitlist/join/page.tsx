"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WaitlistJoin } from "@/components/waitlist/join";

function WaitlistJoinInner() {
  const params = useSearchParams();
  const artistId = params.get("artist") ?? "";
  const artistName = params.get("name") ?? undefined;

  if (!artistId) {
    return <p className="text-sm text-content-muted">Missing artist.</p>;
  }
  return <WaitlistJoin artistId={artistId} artistName={artistName} />;
}

export default function WaitlistJoinPage() {
  return (
    <Suspense fallback={null}>
      <WaitlistJoinInner />
    </Suspense>
  );
}
