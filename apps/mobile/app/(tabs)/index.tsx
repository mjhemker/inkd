import { useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Skeleton,
  Spinner,
  Tabs,
  type IconName,
  type TabItem,
} from "@inkd/ui/native";
import {
  useCurrentProfile,
  useFeedItems,
  useStyleFilters,
  useTodayDrop,
  feedArtistFilterParams,
  describeFeedFilters,
  clearFeedFilterChip,
  hasActiveFeedFilters,
  activeFeedFilterCount,
  EMPTY_FEED_FILTER,
  type FeedFilterState,
  type FeedItem,
  type FeedScope,
} from "@inkd/core";

import { ScreenHeader } from "@/components/ScreenHeader";
import { DailyDropCard } from "@/components/daily-drop/DailyDropCard";
import { FeedCard } from "@/components/feed/FeedCard";
import { FeedFilterSheet } from "@/components/feed/FeedFilterSheet";
import { PostDetailSheet } from "@/components/feed/PostDetailSheet";
import { StyleFilterRow } from "@/components/feed/StyleFilterRow";
import { useTheme } from "@/providers/theme";

const SCOPE_TABS: TabItem[] = [
  { value: "discover", label: "Discover" },
  { value: "following", label: "Following" },
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [scope, setScope] = useState<FeedScope>("discover");
  const [filter, setFilter] = useState<FeedFilterState>(EMPTY_FEED_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<FeedItem | null>(null);

  const { data: profile } = useCurrentProfile();
  const signedIn = Boolean(profile);
  const { data: styleData } = useStyleFilters();
  const styles = styleData ?? [];
  const { data: drop } = useTodayDrop();

  // The chip row is a quick SINGLE-style filter; the sheet handles multi-select.
  const chipSelected = filter.styles.length === 1 ? filter.styles[0] ?? null : null;
  const selectStyleChip = (slug: string | null) =>
    setFilter({ ...filter, styles: slug ? [slug] : [] });
  const artistFilters = feedArtistFilterParams(filter);
  const activeChips = describeFeedFilters(filter, styles);

  const {
    items,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useFeedItems(scope, { styleSlugs: filter.styles, artistFilters });

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
          action={
            <Pressable
              onPress={() => router.push("/search")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Search INKD"
              className="h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-surface-raised active:opacity-80"
            >
              <Icon name="search" size={18} color={colors.text.secondary} />
            </Pressable>
          }
        />
        <Tabs
          value={scope}
          onValueChange={(value) => setScope(value as FeedScope)}
          items={SCOPE_TABS}
        />
      </View>
      <View className="flex-row items-center gap-2 pr-6">
        <View className="min-w-0 flex-1">
          <StyleFilterRow styles={styles} selectedSlug={chipSelected} onSelect={selectStyleChip} />
        </View>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open filters"
          className={
            hasActiveFeedFilters(filter)
              ? "flex-row items-center gap-1.5 rounded-sm border border-brand bg-brand/10 px-3 py-1.5"
              : "flex-row items-center gap-1.5 rounded-sm border border-border-subtle bg-surface-raised px-3 py-1.5"
          }
        >
          <Icon name="settings" size={13} color={colors.text.secondary} />
          <Text className="font-mono text-[11px] font-semibold uppercase tracking-widest text-content-secondary">
            Filters
          </Text>
          {activeFeedFilterCount(filter) > 0 ? (
            <View className="h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1">
              <Text className="text-[10px] font-bold text-brand-on">{activeFeedFilterCount(filter)}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {activeChips.length > 0 ? (
        <View className="flex-row flex-wrap items-center gap-1.5 px-6">
          {activeChips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={() => setFilter(clearFeedFilterChip(filter, chip))}
              className="flex-row items-center gap-1 rounded-sm border border-brand/40 bg-brand/10 px-2 py-1"
            >
              <Text className="text-xs text-content-primary">{chip.label}</Text>
              <Icon name="x" size={11} color={colors.text.muted} />
            </Pressable>
          ))}
          <Pressable onPress={() => setFilter(EMPTY_FEED_FILTER)} hitSlop={6}>
            <Text className="ml-1 font-mono text-[11px] uppercase tracking-wider text-content-muted">Clear all</Text>
          </Pressable>
        </View>
      ) : null}

      {scope === "discover" && drop && (
        <View className="gap-2 px-6">
          <View className="flex-row items-center justify-between">
            <Text className="font-mono text-[11px] font-semibold uppercase tracking-widest text-content-ember">
              Today&apos;s drop
            </Text>
            <Pressable
              onPress={() => router.push("/daily-drop" as never)}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel="See all daily drops"
            >
              <Text className="font-mono text-[11px] uppercase tracking-widest text-content-muted">
                See all
              </Text>
            </Pressable>
          </View>
          <DailyDropCard card={drop} variant="feed" signedIn={signedIn} />
        </View>
      )}
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
            icon={<Icon name="image" size={32} color={colors.text.muted} />}
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
            <FeedCard item={item} onOpen={setSelected} signedIn={signedIn} />
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
          <View>
            {scope === "following" ? (
              <EmptyState
                className="px-6"
                icon={<Icon name="compass" size={32} color={colors.text.muted} />}
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
                icon={<Icon name="image" size={32} color={colors.text.muted} />}
                title="The wall's still being hung"
                description={
                  hasActiveFeedFilters(filter)
                    ? "Nothing matches these filters yet — try widening them."
                    : "New work from INKD artists drops often — check back soon."
                }
                action={
                  hasActiveFeedFilters(filter) ? (
                    <Button size="md" variant="secondary" onPress={() => setFilter(EMPTY_FEED_FILTER)}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            )}
            {/* Client-facing discovery tools, mirroring the web feed empty state. */}
            <View className="gap-3 px-6 pt-6">
              <ToolCard
                icon="image"
                title="Match my inspiration"
                description="Upload a tattoo you love — find artists whose work matches that vibe."
                onPress={() => router.push("/match-inspiration" as never)}
              />
              <ToolCard
                icon="sparkles"
                title="Try a design on"
                description="Photo-based fit check — size & place it on your own photo. Not AR."
                onPress={() => router.push("/try-on" as never)}
              />
            </View>
          </View>
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        contentContainerClassName="pb-10 pt-2"
      />

      <PostDetailSheet item={selected} onClose={() => setSelected(null)} signedIn={signedIn} />

      <FeedFilterSheet
        open={filtersOpen}
        filter={filter}
        styles={styles}
        onChange={setFilter}
        onReset={() => setFilter(EMPTY_FEED_FILTER)}
        onClose={() => setFiltersOpen(false)}
      />
    </SafeAreaView>
  );
}

function ToolCard({
  icon,
  title,
  description,
  onPress,
}: {
  icon: IconName;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card variant="interactive" padding="md" onPress={onPress} accessibilityLabel={title}>
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-sm border border-border-subtle bg-surface-base">
          <Icon name={icon} size={16} color={colors.text.accent} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="font-sans-semibold text-sm text-content-primary">{title}</Text>
          <Text className="text-xs text-content-muted">{description}</Text>
        </View>
      </View>
    </Card>
  );
}
