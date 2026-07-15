"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button, Icon, TextArea } from "@inkd/ui/web";

/**
 * Message composer. Attachments are gated off for now and shipped text-first,
 * with the affordance visibly disabled rather than silently missing.
 * // TODO(media-bucket): the `media` bucket now exists, but chat image
 * attachments are still blocked on storage RLS — the media bucket only grants
 * public read on `avatar`/`portfolio` path segments and owner-only read
 * elsewhere, so the *other* thread participant cannot read a sender's uploaded
 * attachment. Enabling this needs a new storage policy granting thread
 * participants read access to attachment objects, plus attachment rendering in
 * the message bubble, before wiring this button to upload + pass the path
 * through `sendMessage`'s `attachments` field.
 */
export function Composer({
  onSend,
  disabled,
}: {
  onSend: (body: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t border-border-subtle bg-surface-base px-4 py-3"
    >
      <button
        type="button"
        disabled
        aria-label="Attach a photo (coming soon)"
        title="Photo attachments are coming soon"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-content-muted opacity-40"
      >
        <Icon name="image" size={20} />
      </button>
      <TextArea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write a message…"
        rows={1}
        className="max-h-32 min-h-[40px] flex-1 resize-none py-2.5"
      />
      <Button
        type="submit"
        size="md"
        disabled={disabled || value.trim().length === 0}
        aria-label="Send message"
      >
        <Icon name="arrow-right" size={16} />
        Send
      </Button>
    </form>
  );
}
