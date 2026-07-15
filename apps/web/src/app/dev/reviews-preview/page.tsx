"use client";

/**
 * Dev-only preview harness for the review surfaces that don't already have a
 * home in another harness: the "leave a review" / "edit review" modal and
 * the inline artist-response form. (The Reviews *tab* + profile-hero rating
 * badge are exercised by the real `ArtistProfileView` against seeded data at
 * /dev/profile-preview/public — no reason to duplicate that here.)
 *
 * Presentational components only (`ReviewFormModal`, `ArtistResponseForm`,
 * `ReviewCard` take plain props + callbacks, no Supabase/hooks), so this
 * harness needs no mock client — same network-block workaround noted in
 * ../profile-preview/mockSupabaseClient.ts.
 *
 * Never linked from product nav. Not for production use.
 */
import { useState } from "react";
import { Button } from "@inkd/ui/web";
import { ArtistResponseForm } from "@/components/reviews/artist-response-form";
import { ReviewCard } from "@/components/reviews/review-card";
import { ReviewFormModal, type ReviewFormValues } from "@/components/reviews/review-form-modal";

const SAMPLE_REVIEW = {
  id: "sample",
  artist_id: "sample-artist",
  client_id: "sample-client",
  booking_id: "sample-booking",
  rating: 4,
  title: "Loved the linework",
  body: "Session ran long but the result was worth it — clean, precise, and Nova walked me through aftercare in detail.",
  artist_response: null as string | null,
  is_public: true,
  created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date().toISOString(),
};

export default function ReviewsPreviewPage() {
  const [modalOpen, setModalOpen] = useState(true);
  const [response, setResponse] = useState<string | null>(null);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <span className="w-fit rounded-full border border-border-subtle bg-surface-overlay px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-content-muted">
          Internal · not for production
        </span>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Reviews — form & response
        </h1>
        <p className="text-content-secondary">
          The client-facing review form and the artist-facing response field, in
          isolation. See <code className="font-mono text-content-accent">/dev/profile-preview/public</code>{" "}
          for the Reviews tab + hero aggregate against seeded data.
        </p>
        <Button size="sm" className="w-fit" onClick={() => setModalOpen(true)}>
          Open review form
        </Button>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
          A completed booking, artist view
        </h2>
        <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-raised p-5">
          <ReviewCard
            review={{ ...SAMPLE_REVIEW, artist_response: response }}
            reviewerName="Priya"
            reviewerAvatarUrl={null}
          />
          <ArtistResponseForm initialResponse={response} onSubmit={(r) => setResponse(r)} />
        </div>
      </section>

      <ReviewFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode="create"
        onSubmit={(values: ReviewFormValues) => {
          // No-op: this harness just screenshots the form, it doesn't submit.
          void values;
          setModalOpen(false);
        }}
      />
    </div>
  );
}
