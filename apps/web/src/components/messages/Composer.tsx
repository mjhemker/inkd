"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Icon, Spinner, TextArea, useToast } from "@inkd/ui/web";
import {
  resizeImageForUpload,
  uploadChatAttachment,
  useInkdClient,
  type ChatAttachment,
} from "@inkd/core";

const MAX_ATTACHMENTS = 4;

interface PendingAttachment {
  id: string;
  /** Original picked file, retained so a failed upload can be retried. */
  file: File;
  previewUrl: string;
  status: "uploading" | "done" | "error";
  result?: ChatAttachment;
  error?: string;
}

/**
 * Message composer: text + up to `MAX_ATTACHMENTS` image attachments. Picked
 * images are resized (web canvas, ~1600px long edge) and uploaded into the
 * thread's `chat/{thread_id}/{sender_id}/...` folder as soon as they're
 * picked, so "Send" only has to attach already-uploaded paths — no upload
 * happens on the send critical path.
 */
export function Composer({
  threadId,
  senderId,
  onSend,
  disabled,
}: {
  threadId: string;
  senderId: string | undefined;
  onSend: (body: string, attachments: ChatAttachment[]) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const client = useInkdClient();
  const { toast } = useToast();

  const upload = useMutation({
    mutationFn: (args: { file: Blob; filename: string; contentType?: string; width?: number; height?: number }) =>
      uploadChatAttachment(client, {
        threadId,
        senderId: senderId as string,
        file: args.file,
        filename: args.filename,
        contentType: args.contentType,
        width: args.width,
        height: args.height,
      }),
  });

  const isUploading = pending.some((p) => p.status === "uploading");
  const readyAttachments = pending
    .filter((p): p is PendingAttachment & { result: ChatAttachment } => p.status === "done" && Boolean(p.result))
    .map((p) => p.result);
  const canPickMore = pending.length < MAX_ATTACHMENTS;
  const canSend =
    !disabled && !isUploading && (value.trim().length > 0 || readyAttachments.length > 0);

  async function runUpload(id: string, file: File) {
    setPending((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "uploading", error: undefined } : p)),
    );
    try {
      const resized = await resizeImageForUpload(file);
      const result = await upload.mutateAsync({
        file: resized.blob,
        filename: file.name,
        contentType: resized.blob.type || file.type || "image/jpeg",
        width: resized.width || undefined,
        height: resized.height || undefined,
      });
      setPending((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "done", result } : p)),
      );
    } catch (err) {
      setPending((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: "error",
                error: err instanceof Error ? err.message : "Upload failed",
              }
            : p,
        ),
      );
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !senderId) return;
    const room = MAX_ATTACHMENTS - pending.length;
    if (room <= 0) {
      toast({ title: `You can attach up to ${MAX_ATTACHMENTS} photos`, variant: "info" });
      return;
    }
    const picked = Array.from(files).slice(0, room);

    for (const file of picked) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previewUrl = URL.createObjectURL(file);
      setPending((prev) => [...prev, { id, file, previewUrl, status: "uploading" }]);
      await runUpload(id, file);
    }
  }

  /** Re-attempt a failed upload for its original file, in place. */
  function retryPending(id: string) {
    const target = pending.find((p) => p.id === id);
    if (target) void runUpload(id, target.file);
  }

  function removePending(id: string) {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function submit() {
    if (!canSend) return;
    const trimmed = value.trim();
    onSend(trimmed, readyAttachments);
    for (const p of pending) URL.revokeObjectURL(p.previewUrl);
    setValue("");
    setPending([]);
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
      className="flex flex-col gap-2 border-t border-border-subtle bg-surface-base px-4 py-3"
    >
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pending.map((p) => (
            <div
              key={p.id}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-overlay"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt="Attachment preview"
                className="h-full w-full object-cover"
              />
              {p.status === "uploading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/50">
                  <Spinner size={16} className="text-white" />
                  <span className="font-mono text-[8px] uppercase tracking-wide text-white/90">
                    Sending
                  </span>
                </div>
              )}
              {p.status === "done" && (
                <span
                  className="absolute bottom-0.5 left-0.5 grid h-4 w-4 place-items-center rounded-full bg-success-500 text-white"
                  aria-label="Attached"
                  title="Attached"
                >
                  <Icon name="check" size={11} />
                </span>
              )}
              {p.status === "error" && (
                <button
                  type="button"
                  onClick={() => retryPending(p.id)}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-danger-500/75 text-white outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  aria-label={`Upload failed — retry. ${p.error ?? ""}`}
                  title={p.error ?? "Upload failed — tap to retry"}
                >
                  <Icon name="alert-triangle" size={14} className="text-white" />
                  <span className="font-mono text-[8px] font-semibold uppercase tracking-wide">
                    Retry
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => removePending(p.id)}
                aria-label="Remove attachment"
                className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Icon name="x" size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || !senderId || !canPickMore}
          aria-label="Attach a photo"
          title={canPickMore ? "Attach a photo" : `Up to ${MAX_ATTACHMENTS} photos per message`}
          onClick={() => fileInputRef.current?.click()}
        >
          <Icon name="image" size={20} />
        </Button>
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
          disabled={!canSend}
          aria-label="Send message"
        >
          <Icon name="arrow-right" size={16} />
          Send
        </Button>
      </div>
    </form>
  );
}
