"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@inkd/ui/web";
import {
  useCurrentArtistProfile,
  useCurrentProfile,
  useStartThread,
} from "@inkd/core/hooks";

/**
 * `/messages/new?to=<profileId>` — finds or creates the thread with that
 * profile, then redirects into it. No UI of its own beyond a brief spinner;
 * this is a resolver, not a screen.
 */
export default function NewThreadPage() {
  return (
    <Suspense fallback={<Resolving />}>
      <NewThreadResolver />
    </Suspense>
  );
}

function NewThreadResolver() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const to = searchParams.get("to");

  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const { data: artistProfile, isLoading: artistLoading } = useCurrentArtistProfile();
  const startThread = useStartThread();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    if (profileLoading || artistLoading) return;
    if (!to) {
      setError("Missing ?to= — nobody to message.");
      return;
    }
    if (!profile) {
      setError("Sign in to start a conversation.");
      return;
    }
    attempted.current = true;
    startThread.mutate(
      {
        currentProfileId: profile.id,
        currentArtistProfileId: artistProfile?.id ?? null,
        targetProfileId: to,
      },
      {
        onSuccess: (thread) => router.replace(`/messages/${thread.id}`),
        onError: (err) => setError(err instanceof Error ? err.message : "Couldn't start that conversation."),
      },
    );
  }, [to, profile, artistProfile, profileLoading, artistLoading, startThread, router]);

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-semibold text-content-primary">Couldn&apos;t start that conversation</p>
        <p className="max-w-xs text-sm text-content-muted">{error}</p>
      </div>
    );
  }

  return <Resolving />;
}

function Resolving() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-content-muted">
      <Spinner size={20} />
      <p className="text-sm">Starting conversation…</p>
    </div>
  );
}
