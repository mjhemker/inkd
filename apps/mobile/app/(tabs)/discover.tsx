/**
 * Discover (mobile) — list-first local artist search. Same filters as web
 * (style × city × price band × books-open × distance × text) over the shared
 * `search_artists` RPC via `useDiscover`. Distance sort uses the device
 * location (expo-location) when the user opts in; otherwise a city quick-pick
 * (Baltimore / Philadelphia) provides the center.
 *
 * MAP DECISION: the pilot map is web-first. On mobile we ship the list (the
 * primary browse surface) plus a "map coming soon" placard rather than a
 * half-built native GL map — MapLibre RN + a keyless vector style is a larger
 * lift than this wave, and the list already answers "who's near me, in my
 * style, in my budget, with open books". Distance is shown per card so the
 * ranked list carries the local signal without a canvas.
 */
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Location from "expo-location";
import { Avatar, Chip, Icon, Input, Spinner, Toggle } from "@inkd/ui/native";
import { useDiscover, useStyles } from "@inkd/core/hooks";
import {
  DISCOVER_CITIES,
  PRICE_BANDS,
  RADIUS_OPTIONS_MI,
  DEFAULT_RADIUS_MI,
  milesToKm,
  radiusMatchesMiles,
  formatDistanceMiles,
  discoverFilterToParams,
  formatMinPrice,
  EMPTY_FILTER_STATE,
  type ArtistCard,
  type DiscoverFilterState,
} from "@inkd/core/api";

const MUTED = "#71717A";
const BRAND = "#7C3AED";
const INK = "#0A0A0B";

function styleLabel(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function ArtistPlacardCard({ card }: { card: ArtistCard }) {
  const price = formatMinPrice(card.min_price_cents);
  const distance = card.distance_km != null ? formatDistanceMiles(card.distance_km) : null;
  return (
    <Pressable
      onPress={() => router.push(`/artist/${card.handle}`)}
      className="gap-3 rounded-sm border border-border-subtle bg-surface-raised p-4 active:border-border-strong"
    >
      <View className="flex-row items-start gap-3">
        <Avatar src={card.avatar_url ?? undefined} name={card.display_name} size="lg" shape="square" />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 font-display text-lg text-content-primary" numberOfLines={1}>
              {card.display_name}
            </Text>
            {distance ? (
              <Text className="font-mono text-xs uppercase text-content-muted">{distance}</Text>
            ) : null}
          </View>
          <Text className="font-mono text-xs text-content-muted" numberOfLines={1}>
            @{card.handle}
          </Text>
          <View className="mt-0.5 flex-row items-center gap-1">
            <Icon name="map-pin" size={12} color={MUTED} />
            <Text className="text-xs text-content-secondary" numberOfLines={1}>
              {[card.city, card.state].filter(Boolean).join(", ") || "Location private"}
            </Text>
          </View>
        </View>
      </View>

      {card.styles.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {card.styles.slice(0, 3).map((s) => (
            <View key={s} className="rounded-sm border border-border-subtle bg-surface-overlay px-2 py-0.5">
              <Text className="text-xs text-content-secondary">{styleLabel(s)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          {card.books_open ? (
            <View className="rounded-sm bg-brand px-2 py-1">
              <Text className="font-mono text-[10px] font-bold uppercase tracking-widest text-brand-on">
                Books open
              </Text>
            </View>
          ) : (
            <View className="rounded-sm border border-border-default px-2 py-1">
              <Text className="font-mono text-[10px] font-bold uppercase tracking-widest text-content-muted">
                Books closed
              </Text>
            </View>
          )}
          {card.has_active_flash ? (
            <View className="flex-row items-center gap-1 rounded-sm bg-surface-ember px-2 py-1">
              <Icon name="sparkles" size={11} color={INK} />
              <Text className="font-mono text-[10px] font-bold uppercase tracking-widest text-brand-on-ember">
                Flash
              </Text>
            </View>
          ) : null}
        </View>
        {price ? (
          <Text className="font-hand text-lg text-content-ember">from {price}</Text>
        ) : (
          <Text className="font-mono text-xs uppercase text-content-muted">By quote</Text>
        )}
      </View>
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const [filter, setFilter] = useState<DiscoverFilterState>(EMPTY_FILTER_STATE);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const params = useMemo(() => discoverFilterToParams(filter), [filter]);
  const { data: cards = [], isLoading, isFetching } = useDiscover(params);
  const { data: styles = [] } = useStyles();

  const patch = (p: Partial<DiscoverFilterState>) => setFilter((f) => ({ ...f, ...p }));
  const hasCenter = filter.lat != null && filter.lng != null;
  const nearMeActive = hasCenter && !filter.city;
  const activeStyles = new Set(filter.styles);

  const toggleStyle = (slug: string) => {
    const next = new Set(activeStyles);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    patch({ styles: [...next] });
  };

  const pickCity = (slug: string) => {
    const city = DISCOVER_CITIES.find((c) => c.slug === slug);
    if (!city) return;
    if (filter.city === slug) {
      patch({ city: undefined, lat: undefined, lng: undefined, state: undefined, radiusKm: undefined });
    } else {
      patch({ city: city.slug, lat: city.lat, lng: city.lng, state: city.state, radiusKm: filter.radiusKm ?? milesToKm(DEFAULT_RADIUS_MI) });
    }
  };

  const useMyLocation = async () => {
    setLocError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocError("Location off — pick a city instead.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      patch({
        city: undefined,
        state: undefined,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        radiusKm: filter.radiusKm ?? milesToKm(DEFAULT_RADIUS_MI),
      });
    } catch {
      setLocError("Couldn't get your location — pick a city instead.");
    } finally {
      setLocating(false);
    }
  };

  const header = (
    <View className="gap-4 pb-2">
      <View className="gap-1">
        <Text className="font-mono text-xs uppercase tracking-widest text-content-muted">Discover</Text>
        <Text className="font-display text-3xl text-content-primary">Find your artist</Text>
      </View>

      <Input
        placeholder="Search name, style or city…"
        value={filter.query}
        onChangeText={(t) => patch({ query: t })}
        leadingIcon={<Icon name="search" size={16} color={MUTED} />}
        autoCapitalize="none"
      />

      {/* Location: my location + city quick-picks */}
      <View className="flex-row flex-wrap items-center gap-2">
        <Chip selected={nearMeActive} onPress={useMyLocation} disabled={locating}>
          <View className="flex-row items-center gap-1">
            {locating ? (
              <Spinner size="small" />
            ) : (
              <Icon name="compass" size={13} color={nearMeActive ? "#FFFFFF" : MUTED} />
            )}
            <Text className={nearMeActive ? "text-brand-on" : "text-content-secondary"}>Near me</Text>
          </View>
        </Chip>
        {DISCOVER_CITIES.map((c) => (
          <Chip key={c.slug} selected={filter.city === c.slug} onPress={() => pickCity(c.slug)}>
            {c.label}
          </Chip>
        ))}
      </View>
      {locError ? <Text className="text-xs text-content-ember">{locError}</Text> : null}

      {/* Radius (only when a center is set) */}
      {hasCenter ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">Within</Text>
          {RADIUS_OPTIONS_MI.map((mi) => (
            <Chip
              key={mi}
              selected={radiusMatchesMiles(filter.radiusKm, mi)}
              onPress={() => patch({ radiusKm: milesToKm(mi) })}
            >
              {mi} mi
            </Chip>
          ))}
        </View>
      ) : null}

      {/* Price bands */}
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">Price</Text>
        {PRICE_BANDS.map((b) => (
          <Chip
            key={b.slug}
            selected={filter.priceBand === b.slug}
            onPress={() => patch({ priceBand: filter.priceBand === b.slug ? undefined : b.slug })}
          >
            {b.label}
          </Chip>
        ))}
      </View>

      {/* Books open */}
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-content-secondary">Open books only</Text>
        <Toggle checked={filter.booksOpen} onCheckedChange={(v) => patch({ booksOpen: v })} />
      </View>

      {/* Styles (collapsible) */}
      <Pressable onPress={() => setStylesOpen((v) => !v)} className="flex-row items-center gap-1">
        <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
          Styles{filter.styles.length > 0 ? ` · ${filter.styles.length}` : ""}
        </Text>
        <Icon name={stylesOpen ? "chevron-down" : "chevron-right"} size={12} color={MUTED} />
      </Pressable>
      {stylesOpen ? (
        <View className="flex-row flex-wrap gap-1.5">
          {styles.map((s) => (
            <Chip key={s.slug} selected={activeStyles.has(s.slug)} onPress={() => toggleStyle(s.slug)}>
              {s.name}
            </Chip>
          ))}
        </View>
      ) : null}

      {/* Map placard (see MAP DECISION note above) */}
      <View className="flex-row items-center gap-3 rounded-sm border border-border-subtle bg-surface-overlay px-3 py-2.5">
        <Icon name="map-pin" size={16} color={BRAND} />
        <Text className="flex-1 text-xs text-content-secondary">
          Map view is on web today. Distance ranking is live here — the native map is coming soon.
        </Text>
      </View>

      <View className="flex-row items-center justify-between pt-1">
        <Text className="font-mono text-xs uppercase tracking-wider text-content-secondary">
          {cards.length} {cards.length === 1 ? "artist" : "artists"}
          {isFetching && !isLoading ? " · …" : ""}
        </Text>
        <Pressable onPress={() => setFilter(EMPTY_FILTER_STATE)} className="flex-row items-center gap-1">
          <Icon name="x" size={12} color={MUTED} />
          <Text className="font-mono text-xs uppercase tracking-wider text-content-muted">Clear</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top"]}>
      <FlatList
        data={cards}
        keyExtractor={(c) => c.artist_id}
        renderItem={({ item }) => <ArtistPlacardCard card={item} />}
        ListHeaderComponent={header}
        contentContainerClassName="gap-3 px-6 py-6"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          isLoading ? (
            <View className="items-center py-16">
              <Spinner />
            </View>
          ) : (
            <View className="items-center gap-2 py-16">
              <Icon name="search" size={28} color={MUTED} />
              <Text className="font-display text-lg text-content-primary">No artists match</Text>
              <Text className="max-w-xs text-center text-sm text-content-secondary">
                Try widening the distance, clearing a style, or a different price band.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
