"use client";

/**
 * OFFLINE preview harness for the Instagram import UI, rendered against an
 * in-memory fake Supabase client (egress to Supabase is policy-blocked here).
 * Screenshot/QA aid only — not shipped to users.
 *
 * Settings section (4 server states):
 *   /dev/instagram-preview?view=settings&scenario=not-connected
 *   ...scenario=connected | token-expired | coming-soon
 *
 * Picker (grid + all badge states; drive select-all → import in the browser to
 * reach the completion sheet):
 *   /dev/instagram-preview?view=picker&scenario=connected
 */
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InkdProvider } from "@inkd/core/hooks";
import type { ArtistProfile } from "@inkd/core";
import { Spinner, ToastProvider } from "@inkd/ui/web";

import { ConnectedAccountsEditor } from "@/components/artist/connected-accounts";
import { InstagramImportModal } from "@/components/artist/instagram/InstagramImportModal";
import { createFakeInstagramClient, type InstagramScenario } from "./fake-client";

const ARTIST = { id: "demo-ig-artist" } as ArtistProfile;

function Preview() {
  const params = useSearchParams();
  const scenario = (params.get("scenario") as InstagramScenario | null) ?? "connected";
  const view = params.get("view") ?? "settings";
  const [client] = useState(() => createFakeInstagramClient(scenario));

  return (
    <InkdProvider client={client}>
      <ToastProvider>
        {view === "picker" ? (
          <InstagramImportModal
            artistId={ARTIST.id}
            open
            onClose={() => {}}
            portfolioHref="/profile"
          />
        ) : (
          <div className="mx-auto w-full max-w-3xl px-5 py-10">
            <ConnectedAccountsEditor artist={ARTIST} />
          </div>
        )}
      </ToastProvider>
    </InkdProvider>
  );
}

export default function InstagramPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center bg-surface-base">
          <Spinner size={26} />
        </div>
      }
    >
      <Preview />
    </Suspense>
  );
}
