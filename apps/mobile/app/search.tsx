/**
 * Global search (mobile) — the counterpart to the web ⌘K command palette.
 * Searches across artists, shops, styles and cities (see `globalSearch` in
 * @inkd/core for the deliberate client-account exclusion — clients are private
 * by design and never searchable). Debounced, trgm typo-tolerant, with local
 * recent searches (AsyncStorage). Opened from the home / discover header search
 * affordance.
 */
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Avatar, Icon, Input, Spinner } from "@inkd/ui/native";
import {
  useGlobalSearch,
  flattenSearchResults,
  searchResultHref,
  addRecentSearch,
  removeRecentSearch,
  parseRecentSearches,
  RECENT_SEARCHES_KEY,
  type SearchResult,
  type RecentSearch,
} from "@inkd/core";
import { useTheme } from "@/providers/theme";

function styleLabel(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

type Row =
  | { type: "header"; key: string; label: string }
  | { type: "result"; key: string; result: SearchResult };

export default function SearchScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<RecentSearch[]>([]);

  const { results, isLoading, isFetching, isEmpty, query: debounced, count } =
    useGlobalSearch(query);

  // Load recents on mount.
  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then((raw) => setRecents(parseRecentSearches(raw)))
      .catch(() => setRecents([]));
  }, []);

  const persistRecents = useCallback((next: RecentSearch[]) => {
    setRecents(next);
    AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const go = useCallback(
    (result: SearchResult) => {
      if (debounced.trim().length >= 2) {
        persistRecents(addRecentSearch(recents, debounced));
      }
      router.push(searchResultHref(result, "mobile") as never);
    },
    [debounced, recents, persistRecents],
  );

  // Flatten grouped results into a section list.
  const rows: Row[] = [];
  if (debounced.length >= 2 && count > 0) {
    const groups: { label: string; items: SearchResult[] }[] = [
      { label: "Artists", items: results.artists },
      { label: "Shops", items: results.shops },
      { label: "Styles", items: results.styles },
      { label: "Cities", items: results.cities },
    ];
    for (const g of groups) {
      if (g.items.length === 0) continue;
      rows.push({ type: "header", key: `h:${g.label}`, label: g.label });
      for (const item of g.items) {
        rows.push({
          type: "result",
          key: `r:${g.label}:${flattenSearchResults(results).indexOf(item)}:${
            "id" in item ? item.id : item.slug
          }`,
          result: item,
        });
      }
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top"]}>
      {/* Search bar row */}
      <View className="flex-row items-center gap-2 px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-10 w-10 items-center justify-center"
        >
          <Icon name="chevron-left" size={22} color={colors.text.primary} />
        </Pressable>
        <View className="flex-1">
          <Input
            placeholder="Search artists, shops, styles, cities…"
            value={query}
            onChangeText={setQuery}
            leadingIcon={<Icon name="search" size={16} color={colors.text.muted} />}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
          />
        </View>
        {isFetching ? <Spinner size="small" /> : null}
      </View>

      {debounced.length < 2 ? (
        <RecentsList
          recents={recents}
          onPick={setQuery}
          onRemove={(q) => persistRecents(removeRecentSearch(recents, q))}
          onClear={() => persistRecents([])}
        />
      ) : isLoading ? (
        <View className="items-center py-16">
          <Spinner />
        </View>
      ) : isEmpty ? (
        <View className="items-center gap-2 px-8 py-16">
          <Icon name="search" size={28} color={colors.text.muted} />
          <Text className="font-display text-lg text-content-primary">
            No results for “{debounced}”
          </Text>
          <Text className="max-w-xs text-center text-sm text-content-secondary">
            Try a different spelling, a broader style, or one of the pilot cities.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-4 pb-10"
          renderItem={({ item }) =>
            item.type === "header" ? (
              <Text className="px-1 pb-1 pt-4 font-mono text-[10px] uppercase tracking-widest text-content-muted">
                {item.label}
              </Text>
            ) : (
              <ResultRow result={item.result} onPress={() => go(item.result)} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

function ResultRow({ result, onPress }: { result: SearchResult; onPress: () => void }) {
  const { colors } = useTheme();

  let avatar: React.ReactNode;
  let title = "";
  let handle: string | undefined;
  let stamps: string[] = [];
  let meta: string | undefined;
  let city: string | undefined;

  if (result.kind === "artist") {
    avatar = <Avatar src={result.avatarUrl ?? undefined} name={result.displayName} size="md" shape="square" />;
    title = result.displayName;
    handle = result.handle;
    stamps = result.styles.slice(0, 3);
    city = [result.city, result.state].filter(Boolean).join(", ") || undefined;
  } else if (result.kind === "shop") {
    avatar = <Avatar src={result.avatarUrl ?? undefined} name={result.name} size="md" shape="square" />;
    title = result.name;
    handle = result.handle;
    meta = `${result.memberCount} ${result.memberCount === 1 ? "artist" : "artists"}`;
    city = [result.city, result.state].filter(Boolean).join(", ") || undefined;
  } else if (result.kind === "style") {
    avatar = <GlyphTile icon="sparkles" />;
    title = result.name;
    meta = "Browse this style in discover";
  } else {
    avatar = <GlyphTile icon="map-pin" />;
    title = result.label;
    meta = `Artists near ${result.label}, ${result.state}`;
  }

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-sm px-1 py-2.5 active:bg-surface-overlay"
    >
      {avatar}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="flex-shrink text-sm font-sans-semibold text-content-primary" numberOfLines={1}>
            {title}
          </Text>
          {handle ? (
            <Text className="font-mono text-xs text-content-muted" numberOfLines={1}>
              @{handle}
            </Text>
          ) : null}
        </View>
        {stamps.length > 0 ? (
          <View className="mt-1 flex-row flex-wrap gap-1">
            {stamps.map((s) => (
              <View key={s} className="rounded-sm border border-border-subtle bg-surface-overlay px-1.5 py-0.5">
                <Text className="text-[10px] text-content-secondary">{styleLabel(s)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {meta ? <Text className="mt-0.5 text-xs text-content-muted">{meta}</Text> : null}
        {city ? (
          <View className="mt-0.5 flex-row items-center gap-1">
            <Icon name="map-pin" size={11} color={colors.text.muted} />
            <Text className="text-xs text-content-muted" numberOfLines={1}>{city}</Text>
          </View>
        ) : null}
      </View>
      <Icon name="arrow-right" size={15} color={colors.text.muted} />
    </Pressable>
  );
}

function GlyphTile({ icon }: { icon: "sparkles" | "map-pin" }) {
  const { colors } = useTheme();
  return (
    <View className="h-11 w-11 items-center justify-center rounded-sm border border-border-subtle bg-surface-overlay">
      <Icon name={icon} size={18} color={colors.text.accent} />
    </View>
  );
}

function RecentsList({
  recents,
  onPick,
  onRemove,
  onClear,
}: {
  recents: RecentSearch[];
  onPick: (q: string) => void;
  onRemove: (q: string) => void;
  onClear: () => void;
}) {
  const { colors } = useTheme();
  if (recents.length === 0) {
    return (
      <View className="items-center gap-2 px-8 py-16">
        <Icon name="search" size={28} color={colors.text.muted} />
        <Text className="text-center text-sm text-content-secondary">
          Search artists, shops, styles and cities.
        </Text>
        <Text className="max-w-xs text-center text-xs text-content-muted">
          Try a name, a style like “fine line”, or a city like “Baltimore”.
        </Text>
      </View>
    );
  }
  return (
    <View className="px-4">
      <View className="flex-row items-center justify-between pb-1 pt-4">
        <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">Recent</Text>
        <Pressable onPress={onClear} hitSlop={8}>
          <Text className="font-mono text-[10px] uppercase tracking-wider text-content-muted">Clear</Text>
        </Pressable>
      </View>
      {recents.map((r) => (
        <View key={r.query} className="flex-row items-center gap-3 py-2.5">
          <Icon name="clock" size={15} color={colors.text.muted} />
          <Pressable onPress={() => onPick(r.query)} className="flex-1">
            <Text className="text-sm text-content-secondary" numberOfLines={1}>{r.query}</Text>
          </Pressable>
          <Pressable onPress={() => onRemove(r.query)} hitSlop={8} accessibilityLabel={`Remove ${r.query}`}>
            <Icon name="x" size={14} color={colors.text.muted} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
