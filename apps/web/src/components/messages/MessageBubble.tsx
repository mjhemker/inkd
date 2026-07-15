"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Icon, Modal, Spinner, cx } from "@inkd/ui/web";
import { formatMessageTime } from "@inkd/core/utils";
import { getChatAttachmentUrls, toChatAttachments, useInkdClient } from "@inkd/core";
import type { Message } from "@inkd/core/types";

/**
 * One chat bubble. `isMine` controls side + color; `sender_kind === "agent"`
 * (SPEC §5 trust requirements) gets a distinct treatment on top of that — a
 * mono "Drafted by AI staff" eyebrow and a dashed, tinted bubble — so a client
 * or artist can never mistake AI-authored copy for a human's own words.
 * `drafted_by_agent` on an artist-sent message (drafted by AI, sent by a
 * human) gets a quieter provenance chip for the same reason.
 *
 * Image attachments render as thumbnails above the text bubble (or in place
 * of it, for an attachment-only message) and resolve short-lived signed URLs
 * — the `media` bucket's chat/ prefix is never publicly readable, unlike
 * avatar/portfolio paths. Tapping a thumbnail opens a full-size lightbox.
 */
export function MessageBubble({
  message,
  isMine,
}: {
  message: Message;
  isMine: boolean;
}) {
  const isAgent = message.sender_kind === "agent";
  const isHumanDraftedByAgent = !isAgent && message.drafted_by_agent;
  const attachments = toChatAttachments(message.attachments);
  const hasBody = Boolean(message.body?.trim());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const client = useInkdClient();
  const paths = attachments.map((a) => a.path);
  const urlsQuery = useQuery({
    queryKey: ["chatAttachmentUrls", message.id, paths],
    queryFn: () => getChatAttachmentUrls(client, paths),
    enabled: paths.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  return (
    <div className={cx("flex flex-col gap-1", isMine ? "items-end" : "items-start")}>
      {isAgent && (
        <span className="flex items-center gap-2 pl-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-content-accent">
          <span className="flex items-center gap-1">
            <Icon name="sparkles" size={11} />
            Drafted by AI staff
          </span>
          {message.agent_action_id && (
            <Link
              href={`/studio/ai?tab=activity&action=${message.agent_action_id}`}
              className="inline-flex items-center gap-0.5 text-content-muted underline decoration-dotted underline-offset-2 hover:text-content-accent"
            >
              view in log
              <Icon name="arrow-right" size={10} />
            </Link>
          )}
        </span>
      )}

      {attachments.length > 0 && (
        <div className={cx("flex flex-wrap gap-1.5", isMine ? "justify-end" : "justify-start")}>
          {attachments.map((att) => {
            const url = urlsQuery.data?.[att.path];
            return (
              <button
                key={att.path}
                type="button"
                onClick={() => url && setLightboxUrl(url)}
                disabled={!url}
                aria-label="View attachment full size"
                className="relative grid h-36 w-36 place-items-center overflow-hidden rounded-xl border border-border-subtle bg-surface-overlay outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-default"
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="Chat attachment" className="h-full w-full object-cover" />
                ) : urlsQuery.isError ? (
                  <Icon name="x" size={18} className="text-content-muted" />
                ) : (
                  <Spinner size={16} className="text-content-muted" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {(hasBody || attachments.length === 0) && (
        <div
          className={cx(
            "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[65%]",
            isAgent
              ? "rounded-br-sm border border-dashed border-border-accent bg-surface-plate-ink text-content-primary"
              : isMine
                ? "rounded-br-sm bg-brand text-brand-on"
                : "rounded-bl-sm bg-surface-overlay text-content-primary",
          )}
        >
          {message.body ? (
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
          ) : (
            <p className="italic text-content-muted">Empty message</p>
          )}
          {isHumanDraftedByAgent && (
            <p
              className={cx(
                "mt-1.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em]",
                isMine ? "text-brand-on/70" : "text-content-muted",
              )}
            >
              <Icon name="sparkles" size={10} />
              AI-drafted, sent by hand
            </p>
          )}
        </div>
      )}

      <span className="px-0.5 font-mono text-[11px] text-content-muted">
        {formatMessageTime(message.created_at)}
      </span>

      <Modal open={Boolean(lightboxUrl)} onClose={() => setLightboxUrl(null)} size="lg">
        {lightboxUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lightboxUrl}
            alt="Chat attachment, full size"
            className="max-h-[75vh] w-full rounded-lg object-contain"
          />
        )}
      </Modal>
    </div>
  );
}
