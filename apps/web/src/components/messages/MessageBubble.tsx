import { Icon, cx } from "@inkd/ui/web";
import { formatMessageTime } from "@inkd/core/utils";
import type { Message } from "@inkd/core/types";

/**
 * One chat bubble. `isMine` controls side + color; `sender_kind === "agent"`
 * (SPEC §5 trust requirements) gets a distinct treatment on top of that — a
 * mono "Drafted by AI staff" eyebrow and a dashed, tinted bubble — so a client
 * or artist can never mistake AI-authored copy for a human's own words.
 * `drafted_by_agent` on an artist-sent message (drafted by AI, sent by a
 * human) gets a quieter provenance chip for the same reason.
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

  return (
    <div className={cx("flex flex-col gap-1", isMine ? "items-end" : "items-start")}>
      {isAgent && (
        <span className="flex items-center gap-1 pl-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-content-accent">
          <Icon name="sparkles" size={11} />
          Drafted by AI staff
        </span>
      )}
      <div
        className={cx(
          "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[65%]",
          isAgent
            ? "rounded-br-sm border border-dashed border-brand/45 bg-brand/[0.08] text-content-primary"
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
      <span className="px-0.5 font-mono text-[11px] text-content-muted">
        {formatMessageTime(message.created_at)}
      </span>
    </div>
  );
}
