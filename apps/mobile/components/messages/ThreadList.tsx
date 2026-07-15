import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar, Badge, EmptyState, Icon, Input, Spinner } from "@inkd/ui/native";
import {
  useCurrentArtistProfile,
  useCurrentProfile,
  useThreadSummaries,
} from "@inkd/core/hooks";
import { formatThreadTimestamp } from "@inkd/core/utils";
import type { ThreadSummary } from "@inkd/core/api";
import { useMemo, useState } from "react";

export function ThreadList() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const { data: profile } = useCurrentProfile();
  const { data: artistProfile } = useCurrentArtistProfile();
  const { data: threads, isLoading } = useThreadSummaries(profile?.id, artistProfile?.id);

  const filtered = useMemo(() => {
    if (!threads) return [];
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const name = t.counterpart?.displayName?.toLowerCase() ?? "";
      const handle = t.counterpart?.handle?.toLowerCase() ?? "";
      const preview = t.lastMessage?.body?.toLowerCase() ?? "";
      return name.includes(q) || handle.includes(q) || preview.includes(q);
    });
  }, [threads, query]);

  return (
    <View className="flex-1">
      <View className="gap-3 px-4 pb-3">
        <Input
          size="sm"
          placeholder="Search conversations"
          value={query}
          onChangeText={setQuery}
          leadingIcon={<Icon name="search" size={16} color="#71717A" />}
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center py-16">
          <Spinner size="small" />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          className="px-6"
          icon={<Icon name="message-circle" size={28} color="#71717A" />}
          title={threads && threads.length > 0 ? "No matches" : "No conversations yet"}
          description={
            threads && threads.length > 0
              ? `Nothing matches "${query}".`
              : "Message an artist from their profile, or a client from a booking — it'll land here."
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ThreadRow thread={item} onPress={() => router.push(`/messages/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

function ThreadRow({ thread, onPress }: { thread: ThreadSummary; onPress: () => void }) {
  const unread = thread.unreadCount > 0;
  const last = thread.lastMessage;
  const isAgentDraft = last?.senderKind === "agent";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 border-b border-border-subtle/60 px-4 py-3 active:bg-surface-raised"
    >
      <Avatar
        name={thread.counterpart?.displayName ?? "?"}
        src={thread.counterpart?.avatarUrl ?? undefined}
        size="md"
      />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text
            numberOfLines={1}
            className={unread ? "font-sans-semibold text-sm text-content-primary" : "font-sans-medium text-sm text-content-secondary"}
          >
            {thread.counterpart?.displayName ?? "INKD user"}
          </Text>
          {last && (
            <Text className="font-mono text-[11px] text-content-muted">
              {formatThreadTimestamp(last.createdAt)}
            </Text>
          )}
        </View>
        <View className="mt-0.5 flex-row items-center gap-1.5">
          {isAgentDraft && (
            <Text className="font-mono text-[10px] uppercase tracking-widest text-content-accent">
              AI
            </Text>
          )}
          <Text
            numberOfLines={1}
            className={unread ? "flex-1 text-sm text-content-primary" : "flex-1 text-sm text-content-muted"}
          >
            {last?.body ?? "No messages yet"}
          </Text>
        </View>
      </View>
      {unread && (
        <Badge variant="brand" size="sm">
          {thread.unreadCount > 9 ? "9+" : String(thread.unreadCount)}
        </Badge>
      )}
    </Pressable>
  );
}
