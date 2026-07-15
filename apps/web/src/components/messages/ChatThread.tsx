"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar, Eyebrow, Icon, Spinner, useToast } from "@inkd/ui/web";
import {
  useCurrentArtistProfile,
  useCurrentProfile,
  useSendMessage,
  useThreadMessages,
  useThreadSummary,
} from "@inkd/core/hooks";
import { groupByDay } from "@inkd/core/utils";
import type { Message } from "@inkd/core/types";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";

export function ChatThread({ threadId }: { threadId: string }) {
  const { data: profile } = useCurrentProfile();
  const { data: artistProfile } = useCurrentArtistProfile();
  const { data: summary } = useThreadSummary(threadId, profile?.id);
  const { data: messages, isLoading } = useThreadMessages(threadId);
  const sendMutation = useSendMessage(threadId);
  const { toast } = useToast();

  const [pending, setPending] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const myRole = summary?.myRole ?? (artistProfile ? "artist" : "client");
  const mySenderKind: "client" | "artist" = myRole === "artist" ? "artist" : "client";

  const allMessages = [...(messages ?? []), ...pending];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [allMessages.length]);

  function handleSend(body: string) {
    if (!profile) return;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();
    const optimistic: Message = {
      id: tempId,
      thread_id: threadId,
      sender_kind: mySenderKind,
      sender_profile_id: profile.id,
      agent_action_id: null,
      body,
      attachments: [],
      drafted_by_agent: false,
      is_read: false,
      read_at: null,
      created_at: now,
      updated_at: now,
    };
    setPending((prev) => [...prev, optimistic]);
    sendMutation.mutate(
      {
        thread_id: threadId,
        sender_kind: mySenderKind,
        sender_profile_id: profile.id,
        body,
      },
      {
        onSuccess: () => setPending((prev) => prev.filter((m) => m.id !== tempId)),
        onError: () => {
          setPending((prev) => prev.filter((m) => m.id !== tempId));
          toast({
            variant: "danger",
            title: "Message didn't send",
            description: "Check your connection and try again.",
          });
        },
      },
    );
  }

  const groups = groupByDay(allMessages);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
        <Link
          href="/messages"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-content-muted hover:bg-surface-raised md:hidden"
          aria-label="Back to conversations"
        >
          <Icon name="chevron-left" size={20} />
        </Link>
        <Avatar
          name={summary?.counterpart?.displayName ?? "?"}
          src={summary?.counterpart?.avatarUrl ?? undefined}
          size="sm"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-content-primary">
            {summary?.counterpart?.displayName ?? "Conversation"}
          </p>
          {summary?.counterpart?.handle && (
            <p className="truncate font-mono text-xs text-content-muted">
              @{summary.counterpart.handle}
            </p>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-content-muted">
            <Spinner size={20} />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Icon name="message-circle" size={26} className="text-content-muted" />
            <p className="text-sm text-content-secondary">
              Say hello — this is the start of your conversation.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <div key={group.dateKey} className="flex flex-col gap-3">
                <div className="flex items-center justify-center">
                  <Eyebrow className="rounded-full bg-surface-overlay px-3 py-1">
                    {group.label}
                  </Eyebrow>
                </div>
                <div className="flex flex-col gap-3">
                  {group.items.map((message) => {
                    const isMine =
                      mySenderKind === "client"
                        ? message.sender_kind === "client"
                        : message.sender_kind === "artist" || message.sender_kind === "agent";
                    return (
                      <MessageBubble key={message.id} message={message} isMine={isMine} />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Composer onSend={handleSend} disabled={!profile} />
    </div>
  );
}
