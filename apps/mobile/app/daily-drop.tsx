/**
 * Standalone Daily Drop screen — today's personalized pick (full treatment)
 * plus a "Recent drops" history strip. This is the deep-link target for the
 * `daily_drop` notification (`action_url: "/daily-drop"`); notifications.tsx
 * already resolves any `action_url` via a generic `router.push`, so no extra
 * routing wiring is needed here.
 */
import { router, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, EmptyState, Icon, Skeleton } from "@inkd/ui/native";
import { useDropHistory, useTodayDrop, type DailyDropCard as DailyDropCardData } from "@inkd/core";

import { ScreenHeader } from "@/components/ScreenHeader";
import { DailyDropCard } from "@/components/daily-drop/DailyDropCard";
import { ArtworkPlaceholder } from "@/components/feed/ArtworkPlaceholder";
import { placardLine } from "@/components/feed/format";

const HISTORY_LIMIT = 14;

export default function DailyDropScreen() {
  const todayQ = useTodayDrop();
  const historyQ = useDropHistory({ limit: HISTORY_LIMIT });

  const drop = todayQ.data;
  // The history query includes today's row — the "recent drops" strip below
  // should only show what came *before* today's card.
  const history = (historyQ.data ?? []).filter((c) => c.id !== drop?.id);

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-6">
        <BackLink />

        <ScreenHeader
          eyebrow="FOR YOU"
          title="Daily Drop"
          subtitle="One pick a day, chosen for your taste."
        />

        {todayQ.isLoading ? (
          <Skeleton className="aspect-[4/5] w-full rounded-sm" />
        ) : drop ? (
          <DailyDropCard card={drop} variant="full" />
        ) : (
          <EmptyState
            icon={<Icon name="sparkles" size={28} color="#71717A" />}
            title="Your first drop lands tomorrow morning"
            description="INKD is still getting a feel for your taste — follow a few artists and like some posts to help it along."
          />
        )}

        <View className="gap-3">
          <Text className="font-mono text-[11px] uppercase tracking-widest text-content-muted">
            Recent drops
          </Text>

          {historyQ.isLoading ? (
            <View className="gap-2">
              <Skeleton className="h-20 w-full rounded-sm" />
              <Skeleton className="h-20 w-full rounded-sm" />
            </View>
          ) : history.length === 0 ? (
            <Text className="text-sm text-content-secondary">
              Nothing here yet — check back after tomorrow&apos;s drop.
            </Text>
          ) : (
            <View className="gap-2">
              {history.map((card) => (
                <DropHistoryRow key={card.id} card={card} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BackLink() {
  return (
    <Text
      onPress={() => (router.canGoBack() ? router.back() : router.push("/(tabs)"))}
      className="text-sm text-content-secondary"
    >
      {"< Back"}
    </Text>
  );
}

/** A lighter row for a past drop — thumbnail, reason, byline, date. */
function DropHistoryRow({ card }: { card: DailyDropCardData }) {
  const router = useRouter();
  const imageUrl = card.subjectType === "post" ? card.post?.coverUrl : card.flash?.imageUrl;
  const handle = card.artist?.handle ?? null;
  const placard = placardLine({
    styleNames: (card.post?.styleTags ?? card.flash?.styleTags ?? []).map((t) => t.name),
    handle,
    city: card.artist?.city ?? null,
    state: card.artist?.state ?? null,
  });
  const dateLabel = new Date(`${card.dropDate}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <Card
      variant="interactive"
      padding="sm"
      className="flex-row items-center gap-3"
      onPress={() => (handle ? router.push(`/artist/${handle}` as never) : undefined)}
      accessibilityLabel={`Drop from ${dateLabel}`}
    >
      <View className="h-14 w-14 overflow-hidden rounded-sm bg-surface-overlay">
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <ArtworkPlaceholder id={card.id} className="h-full w-full" />
        )}
      </View>
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={1} className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
          {`${dateLabel} · ${placard}`}
        </Text>
        <Text numberOfLines={2} className="text-sm text-content-secondary">
          {card.reason}
        </Text>
      </View>
      <Pressable
        hitSlop={8}
        accessibilityLabel="View drop"
        onPress={() => (handle ? router.push(`/artist/${handle}` as never) : undefined)}
      >
        <Icon name="chevron-right" size={16} color="#71717A" />
      </Pressable>
    </Card>
  );
}
