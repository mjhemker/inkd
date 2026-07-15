import { useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  EmptyState,
  Icon,
  Skeleton,
  Spinner,
  Tabs,
  type TabItem,
} from "@inkd/ui/native";
import {
  useFeedItems,
  useStyleFilters,
  type FeedItem,
  type FeedScope,
} from "@inkd/core";

import { ScreenHeader } from "@/components/ScreenHeader";
import { FeedCard } from "@/components/feed/FeedCard";
import { PostDetailSheet } from "@/components/feed/PostDetailSheet";
import { StyleFilterRow } from "@/components/feed/StyleFilterRow";

const SCOPE_TABS: TabItem[] = [
  { value: "discover", label: "Discover" },
  { value: "following", label: "Following" },
];

export default function HomeScreen() {
  const router = useRouter();
  const [scope, setScope] = useState<FeedScope>("discover");
  const [styleSlug, setStyleSlug] = useState<string | null>(null);
  const [selected, setSelected] = useState<FeedItem | null>(null);

  const { data: styleData } = useStyleFilters();
  const styles = styleData ?? [];

  const {
    items,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useFeedItems(scope, { styleSlug });

  const header = (
    <View className="gap-5 pb-4">
      <View className="gap-3 px-6">
        <ScreenHeader
          eyebrow="FEED"
          title="Home"
          before={
            <View className="flex-row items-center gap-2">
              <View className="h-2.5 w-2.5 rounded-full bg-brand" />
              <Text className="font-display text-base text-content-primary">INKD</Text>
            </View>
          }
        />
        <Tabs
          value={scope}
          onValueChange={(value) => setScope(value as FeedScope)}
          items={SCOPE_TABS}
        />
      </View>
      <StyleFilterRow styles={styles} selectedSlug={styleSlug} onSelect={setStyleSlug} />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <View className="flex-1">
          {header}
          <View className="gap-4 px-6">
            <Skeleton className="aspect-[4/5] w-full rounded-sm" />
            <Skeleton className="aspect-[4/5] w-full rounded-sm" />
            <Skeleton className="aspect-[4/5] w-full rounded-sm" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <View className="flex-1">
          {header}
          <EmptyState
            icon={<Icon name="image" size={32} color="#71717A" />}
            title="Couldn't load the feed"
            description="Something went wrong reaching INKD. Check your connection and try again."
            action={
              <Button size="md" onPress={() => refetch()}>
                Try again
              </Button>
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <View className="px-6">
            <FeedCard item={item} onOpen={setSelected} />
          </View>
        )}
        ItemSeparatorComponent={() => <View className="h-4" />}
        ListHeaderComponent={header}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="items-center py-6">
              <Spinner size="small" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          scope === "following" ? (
            <EmptyState
              className="px-6"
              icon={<Icon name="compass" size={32} color="#71717A" />}
              note="nothing here yet — go follow some artists"
              title="Nothing here yet"
              description="Follow a few artists you like and their new work will land here."
              action={
                <Button size="md" onPress={() => router.push("/(tabs)/discover")}>
                  Discover artists
                </Button>
              }
            />
          ) : (
            <EmptyState
              className="px-6"
              icon={<Icon name="image" size={32} color="#71717A" />}
              title="The wall's still being hung"
              description={
                styleSlug
                  ? "Nothing matches that style yet — try another filter."
                  : "New work from INKD artists drops often — check back soon."
              }
              action={
                styleSlug ? (
                  <Button size="md" variant="secondary" onPress={() => setStyleSlug(null)}>
                    Clear filter
                  </Button>
                ) : undefined
              }
            />
          )
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        contentContainerClassName="pb-10 pt-2"
      />

      <PostDetailSheet item={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}
