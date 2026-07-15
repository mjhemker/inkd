import { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Avatar, Eyebrow, Icon, Spinner, useToast } from "@inkd/ui/native";
import {
  useCurrentArtistProfile,
  useCurrentProfile,
  useSendMessage,
  useThreadMessages,
  useThreadSummary,
} from "@inkd/core/hooks";
import { groupByDay } from "@inkd/core/utils";
import type { Message } from "@inkd/core/types";
import type { ChatAttachment } from "@inkd/core";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";

type Row =
  | { kind: "separator"; key: string; label: string }
  | { kind: "message"; key: string; message: Message; isMine: boolean };

export function ChatThread({ threadId }: { threadId: string }) {
  const router = useRouter();
  const { data: profile } = useCurrentProfile();
  const { data: artistProfile } = useCurrentArtistProfile();
  const { data: summary } = useThreadSummary(threadId, profile?.id);
  const { data: messages, isLoading } = useThreadMessages(threadId);
  const sendMutation = useSendMessage(threadId);
  const { toast } = useToast();

  const [pending, setPending] = useState<Message[]>([]);
  const listRef = useRef<FlatList<Row>>(null);

  const myRole = summary?.myRole ?? (artistProfile ? "artist" : "client");
  const mySenderKind: "client" | "artist" = myRole === "artist" ? "artist" : "client";

  const allMessages = [...(messages ?? []), ...pending];
  const groups = groupByDay(allMessages);
  const rows: Row[] = groups.flatMap((group) => [
    { kind: "separator" as const, key: `sep-${group.dateKey}`, label: group.label },
    ...group.items.map((message) => ({
      kind: "message" as const,
      key: message.id,
      message,
      isMine:
        mySenderKind === "client"
          ? message.sender_kind === "client"
          : message.sender_kind === "artist" || message.sender_kind === "agent",
    })),
  ]);

  useEffect(() => {
    if (rows.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [rows.length]);

  function handleSend(body: string, attachments: ChatAttachment[]) {
    if (!profile) return;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();
    const optimistic: Message = {
      id: tempId,
      thread_id: threadId,
      sender_kind: mySenderKind,
      sender_profile_id: profile.id,
      agent_action_id: null,
      body: body || null,
      attachments: attachments as unknown as Message["attachments"],
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
        body: body || null,
        attachments: attachments as unknown as Record<string, unknown>[],
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

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <View className="flex-row items-center gap-3 border-b border-border-subtle px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to conversations"
            className="h-9 w-9 items-center justify-center rounded-lg"
          >
            <Icon name="chevron-left" size={22} color="#FAFAFA" />
          </Pressable>
          <Avatar
            name={summary?.counterpart?.displayName ?? "?"}
            src={summary?.counterpart?.avatarUrl ?? undefined}
            size="sm"
          />
          <View className="min-w-0">
            <Text numberOfLines={1} className="font-sans-semibold text-sm text-content-primary">
              {summary?.counterpart?.displayName ?? "Conversation"}
            </Text>
            {summary?.counterpart?.handle && (
              <Text numberOfLines={1} className="font-mono text-xs text-content-muted">
                @{summary.counterpart.handle}
              </Text>
            )}
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <Spinner size="small" />
          </View>
        ) : rows.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-2 px-8">
            <Icon name="message-circle" size={28} color="#71717A" />
            <Text className="text-center text-sm text-content-secondary">
              Say hello — this is the start of your conversation.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(row) => row.key}
            contentContainerClassName="px-4 py-4"
            renderItem={({ item }) =>
              item.kind === "separator" ? (
                <View className="my-3 items-center">
                  <Eyebrow className="rounded-full bg-surface-overlay px-3 py-1">
                    {item.label}
                  </Eyebrow>
                </View>
              ) : (
                <MessageBubble message={item.message} isMine={item.isMine} />
              )
            }
          />
        )}

        <Composer
          threadId={threadId}
          senderId={profile?.id}
          onSend={handleSend}
          disabled={!profile}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
