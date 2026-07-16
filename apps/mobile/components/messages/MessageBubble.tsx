import { useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Icon, Modal, cx } from "@inkd/ui/native";
import { formatMessageTime } from "@inkd/core/utils";
import { getChatAttachmentUrls, toChatAttachments, useInkdClient } from "@inkd/core";
import type { Message } from "@inkd/core/types";
import { useTheme } from "@/providers/theme";

/**
 * One chat bubble. `isMine` sets side + color; `sender_kind === "agent"`
 * (SPEC §5 trust requirements) gets its own treatment on top — a mono
 * "Drafted by AI staff" eyebrow and a dashed, tinted bubble — so AI-authored
 * copy is never mistaken for a human's own words. A human-sent message that
 * was `drafted_by_agent` gets a quieter provenance line for the same reason.
 *
 * Image attachments render as thumbnails, resolving short-lived signed URLs
 * (the `media` bucket's chat/ prefix is never publicly readable). Tapping a
 * thumbnail opens a full-size lightbox.
 */
export function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  const { colors } = useTheme();
  const isAgent = message.sender_kind === "agent";
  const isHumanDraftedByAgent = !isAgent && message.drafted_by_agent;
  const attachments = toChatAttachments(message.attachments);
  const hasBody = Boolean(message.body?.trim());
  const [lightbox, setLightbox] = useState<{ url: string; aspectRatio: number } | null>(null);

  const client = useInkdClient();
  const paths = attachments.map((a) => a.path);
  const urlsQuery = useQuery({
    queryKey: ["chatAttachmentUrls", message.id, paths],
    queryFn: () => getChatAttachmentUrls(client, paths),
    enabled: paths.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  return (
    <View className={cx("mb-3 flex-col", isMine ? "items-end" : "items-start")}>
      {isAgent && (
        <View className="mb-1 flex-row items-center gap-2 pl-0.5">
          <View className="flex-row items-center gap-1">
            <Icon name="sparkles" size={11} color={colors.text.accent} />
            <Text className="font-mono text-[10px] uppercase tracking-widest text-content-accent">
              Drafted by AI staff
            </Text>
          </View>
          {message.agent_action_id ? (
            <Pressable
              accessibilityRole="link"
              onPress={() =>
                router.push(
                  `/studio/ai?tab=activity&action=${message.agent_action_id}` as never,
                )
              }
              className="flex-row items-center gap-0.5"
            >
              <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted underline">
                view in log
              </Text>
              <Icon name="arrow-right" size={10} color={colors.text.muted} />
            </Pressable>
          ) : null}
        </View>
      )}

      {attachments.length > 0 && (
        <View className={cx("mb-1 flex-row flex-wrap gap-1.5", isMine ? "justify-end" : "justify-start")}>
          {attachments.map((att) => {
            const url = urlsQuery.data?.[att.path];
            return (
              <Pressable
                key={att.path}
                disabled={!url}
                onPress={() =>
                  url &&
                  setLightbox({
                    url,
                    aspectRatio: att.width && att.height ? att.width / att.height : 1,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="View attachment full size"
                className="h-36 w-36 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-surface-overlay"
              >
                {url ? (
                  <Image source={{ uri: url }} className="h-full w-full" resizeMode="cover" />
                ) : urlsQuery.isError ? (
                  <Icon name="x" size={18} color={colors.text.muted} />
                ) : (
                  <ActivityIndicator size="small" color={colors.text.accent} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {(hasBody || attachments.length === 0) && (
        <View
          className={cx(
            "max-w-[80%] rounded-2xl px-3.5 py-2.5",
            isAgent
              ? "rounded-br-sm border border-dashed border-border-accent bg-surface-plate-ink"
              : isMine
                ? "rounded-br-sm bg-brand"
                : "rounded-bl-sm bg-surface-overlay",
          )}
        >
          <Text
            className={cx(
              "font-sans text-sm leading-relaxed",
              isAgent ? "text-content-primary" : isMine ? "text-brand-on" : "text-content-primary",
            )}
          >
            {message.body ?? "Empty message"}
          </Text>
          {isHumanDraftedByAgent && (
            <View className="mt-1.5 flex-row items-center gap-1">
              <Icon name="sparkles" size={10} color={isMine ? "#FAFAFA" : colors.text.muted} />
              <Text
                className={cx(
                  "font-mono text-[10px] uppercase tracking-widest",
                  isMine ? "text-brand-on/70" : "text-content-muted",
                )}
              >
                AI-drafted, sent by hand
              </Text>
            </View>
          )}
        </View>
      )}

      <Text className="mt-1 px-0.5 font-mono text-[11px] text-content-muted">
        {formatMessageTime(message.created_at)}
      </Text>

      <Modal open={Boolean(lightbox)} onClose={() => setLightbox(null)} className="max-w-full">
        {lightbox && (
          <Image
            source={{ uri: lightbox.url }}
            style={{ width: "100%", aspectRatio: lightbox.aspectRatio, borderRadius: 12 }}
            resizeMode="contain"
          />
        )}
      </Modal>
    </View>
  );
}
