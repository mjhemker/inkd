/**
 * The "leave a review" / "edit your review" dialog (native). Presentational
 * + a plain `onSubmit` callback — no hooks/Supabase inside — mirrors
 * apps/web/src/components/reviews/review-form-modal.tsx.
 */
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { Button, FormField, Input, Modal, TextArea } from "@inkd/ui/native";
import { RatingStamps } from "./rating-stamps";

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

  // Reset the form to the current `initial` values each time the modal opens.
  // `initial` is a snapshot read at open time, not a value the form should
  // track live while it's showing.
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
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button
            onPress={() => onSubmit({ rating, title: title.trim(), body: body.trim() })}
            disabled={!canSubmit}
            loading={submitting}
          >
            {mode === "edit" ? "Save changes" : "Submit review"}
          </Button>
        </>
      }
    >
      <ScrollView className="max-h-96" contentContainerClassName="gap-4" showsVerticalScrollIndicator={false}>
        <FormField label="Rating">
          <RatingStamps value={rating} onChange={setRating} size="lg" showLabel />
        </FormField>
        <FormField label="Title" description="Optional">
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="Sum it up in a few words"
            maxLength={120}
          />
        </FormField>
        <FormField label="Your review">
          <TextArea
            value={body}
            onChangeText={setBody}
            placeholder="How was the session, the studio, the result?"
            maxLength={4000}
          />
        </FormField>
      </ScrollView>
    </Modal>
  );
}
