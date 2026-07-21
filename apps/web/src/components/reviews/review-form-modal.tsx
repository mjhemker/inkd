"use client";

/**
 * The "leave a review" / "edit your review" dialog. Presentational + a
 * plain `onSubmit` callback — no hooks/Supabase inside — so booking-detail
 * wires up the real mutation and the /dev harness can render it against a
 * no-op for screenshots.
 */
import { useEffect, useState } from "react";
import { Button, FormField, Input, Modal, StarRating, TextArea } from "@inkd/ui/web";

export interface ReviewFormValues {
  rating: number;
  title: string;
  body: string;
}

export function ReviewFormModal({
  open,
  onClose,
  mode = "create",
  initial,
  onSubmit,
  submitting = false,
}: {
  open: boolean;
  onClose: () => void;
  mode?: "create" | "edit";
  initial?: Partial<ReviewFormValues>;
  onSubmit: (values: ReviewFormValues) => void | Promise<void>;
  submitting?: boolean;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");

  // Reset the form to the current `initial` values each time the modal opens
  // (covers both a fresh "leave a review" and re-opening to edit). Only
  // depends on `open` intentionally — `initial` is a snapshot read at open
  // time, not a value the form should track live while it's showing.
  const initialRating = initial?.rating;
  const initialTitle = initial?.title;
  const initialBody = initial?.body;
  useEffect(() => {
    if (!open) return;
    setRating(initialRating ?? 0);
    setTitle(initialTitle ?? "");
    setBody(initialBody ?? "");
  }, [open, initialRating, initialTitle, initialBody]);

  const canSubmit = rating >= 1 && rating <= 5 && !submitting;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Edit your review" : "Leave a review"}
      description="Rate your session and let others know how it went."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit({ rating, title: title.trim(), body: body.trim() })}
            disabled={!canSubmit}
            loading={submitting}
          >
            {mode === "edit" ? "Save changes" : "Submit review"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <FormField label="Rating" htmlFor="review-rating">
          {/* Authoring is whole-star: the DB `rating` is a smallint 1–5
              (see reviews migration), so half-stars are display-only. */}
          <StarRating value={rating} onChange={setRating} size="lg" showLabel allowHalf={false} />
        </FormField>
        <FormField label="Title" htmlFor="review-title" description="Optional">
          <Input
            id="review-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sum it up in a few words"
            maxLength={120}
          />
        </FormField>
        <FormField label="Your review" htmlFor="review-body">
          <TextArea
            id="review-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="How was the session, the studio, the result?"
            maxLength={4000}
          />
        </FormField>
      </div>
    </Modal>
  );
}
