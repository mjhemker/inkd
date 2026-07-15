"use client";

/** Inline artist-response editor shown under a review on booking detail.
 * Presentational + `onSubmit` callback, same shape as `review-form-modal`. */
import { useState } from "react";
import { Button, TextArea } from "@inkd/ui/web";

export function ArtistResponseForm({
  initialResponse,
  onSubmit,
  submitting = false,
}: {
  initialResponse?: string | null;
  onSubmit: (response: string) => void | Promise<void>;
  submitting?: boolean;
}) {
  const [value, setValue] = useState(initialResponse ?? "");
  const hasExisting = Boolean(initialResponse?.trim());

  return (
    <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
      <span className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
        {hasExisting ? "Edit your response" : "Respond to this review"}
      </span>
      <TextArea
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Thank the client, add context, or clear anything up — this shows publicly under their review."
        maxLength={4000}
      />
      <Button
        size="sm"
        variant="secondary"
        className="self-end"
        disabled={!value.trim() || submitting}
        loading={submitting}
        onClick={() => onSubmit(value.trim())}
      >
        {hasExisting ? "Update response" : "Post response"}
      </Button>
    </div>
  );
}
