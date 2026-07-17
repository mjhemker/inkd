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
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { Avatar, Chip, Icon, Input, RangeSlider, Slider, Spinner, Toggle } from "@inkd/ui/native";
import { useDiscover, useStyles } from "@inkd/core/hooks";
import { useTheme } from "@/providers/theme";
import {
  DISCOVER_CITIES,
  DEFAULT_RADIUS_MI,
  milesToKm,
  kmToMiles,
  formatDistanceMiles,
  formatPriceUsd,
  formatDistanceSliderMi,
  discoverFilterToParams,
  queryToDiscoverFilter,
  formatMinPrice,
  PRICE_SLIDER_MIN_USD,
  PRICE_SLIDER_MAX_USD,
  PRICE_SLIDER_STEP_USD,
  DISTANCE_SLIDER_MIN_MI,
  DISTANCE_SLIDER_MAX_MI,
  DISTANCE_SLIDER_STEP_MI,
  EMPTY_FILTER_STATE,
  type ArtistCard,
  type DiscoverFilterState,
} from "@inkd/core/api";

const BRAND = "#7C3AED";
const INK = "#0A0A0B";

const COMMIT_DEBOUNCE_MS = 280;

function styleLabel(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** Clamp + round a km radius into a whole-mile slider value (max = uncapped). */
function radiusToMi(radiusKm: number | undefined): number {
  if (radiusKm == null) return DISTANCE_SLIDER_MAX_MI;
  const mi = Math.round(kmToMiles(radiusKm));
  return Math.min(Math.max(mi, DISTANCE_SLIDER_MIN_MI), DISTANCE_SLIDER_MAX_MI);
}

function ArtistPlacardCard({ card }: { card: ArtistCard }) {
  const { colors } = useTheme();
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
            <Icon name="map-pin" size={12} color={colors.text.muted} />
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
  const { colors } = useTheme();
  // Seed from deep-link params (global search "style"/"city" hits route here,
  // e.g. /discover?styles=fine-line or /discover?city=baltimore).
  const routeParams = useLocalSearchParams<{ styles?: string; city?: string; state?: string; q?: string }>();
  const [filter, setFilter] = useState<DiscoverFilterState>(() =>
    queryToDiscoverFilter((k) => {
      const v = (routeParams as Record<string, string | string[] | undefined>)[k];
      return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? null : null;
    }),
  );
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

  // Debounced slider commits: thumbs move against local state for instant
  // feedback; the params/RPC commit is debounced so a drag isn't a query storm.
  const [priceLocal, setPriceLocal] = useState<[number, number]>([
    filter.priceMinUsd ?? PRICE_SLIDER_MIN_USD,
    filter.priceMaxUsd ?? PRICE_SLIDER_MAX_USD,
  ]);
  const [distLocal, setDistLocal] = useState<number>(radiusToMi(filter.radiusKm));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPriceLocal([filter.priceMinUsd ?? PRICE_SLIDER_MIN_USD, filter.priceMaxUsd ?? PRICE_SLIDER_MAX_USD]);
  }, [filter.priceMinUsd, filter.priceMaxUsd]);
  useEffect(() => {
    setDistLocal(radiusToMi(filter.radiusKm));
  }, [filter.radiusKm]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const debouncedPatch = (p: Partial<DiscoverFilterState>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFilter((f) => ({ ...f, ...p })), COMMIT_DEBOUNCE_MS);
  };

  const onPriceChange = ([lo, hi]: [number, number]) => {
    setPriceLocal([lo, hi]);
    debouncedPatch({
      priceMinUsd: lo > PRICE_SLIDER_MIN_USD ? lo : undefined,
      priceMaxUsd: hi < PRICE_SLIDER_MAX_USD ? hi : undefined,
    });
  };

  const onDistanceChange = (mi: number) => {
    setDistLocal(mi);
    debouncedPatch({ radiusKm: mi >= DISTANCE_SLIDER_MAX_MI ? undefined : milesToKm(mi) });
  };

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
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="font-mono text-xs uppercase tracking-widest text-content-muted">Discover</Text>
          <Text className="font-display text-3xl text-content-primary">Find your artist</Text>
        </View>
        <Pressable
          onPress={() => router.push("/search")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Search INKD"
          className="h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-surface-raised active:opacity-80"
        >
          <Icon name="search" size={18} color={colors.text.secondary} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push("/match-inspiration")}
        className="flex-row items-center gap-3 rounded-sm bg-surface-ember px-4 py-3 active:opacity-90"
      >
        <Icon name="sparkles" size={18} color={INK} />
        <View className="min-w-0 flex-1">
          <Text className="font-display text-sm text-brand-on-ember">Match my inspiration</Text>
          <Text className="text-xs text-brand-on-ember/80">Search by image — upload a tattoo you love</Text>
        </View>
        <Icon name="arrow-right" size={16} color={INK} />
      </Pressable>

      <Input
        placeholder="Search name, style or city…"
        value={filter.query}
        onChangeText={(t) => patch({ query: t })}
        leadingIcon={<Icon name="search" size={16} color={colors.text.muted} />}
        autoCapitalize="none"
      />

      {/* Location: my location + city quick-picks */}
      <View className="flex-row flex-wrap items-center gap-2">
        <Chip selected={nearMeActive} onPress={useMyLocation} disabled={locating}>
          <View className="flex-row items-center gap-1">
            {locating ? (
              <Spinner size="small" />
            ) : (
              <Icon name="compass" size={13} color={nearMeActive ? "#FFFFFF" : colors.text.muted} />
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

      {/* Price (dual-thumb slider) */}
      <View className="gap-1">
        <View className="flex-row items-center justify-between">
          <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">Price</Text>
          <Text className="font-mono text-xs text-content-secondary">
            {formatPriceUsd(priceLocal[0])} – {formatPriceUsd(priceLocal[1])}
          </Text>
        </View>
        <RangeSlider
          value={priceLocal}
          onValueChange={onPriceChange}
          min={PRICE_SLIDER_MIN_USD}
          max={PRICE_SLIDER_MAX_USD}
          step={PRICE_SLIDER_STEP_USD}
        />
      </View>

      {/* Distance (single-thumb slider; needs a center) */}
      <View className="gap-1">
        <View className="flex-row items-center justify-between">
          <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">Distance</Text>
          <Text className="font-mono text-xs text-content-secondary">
            {hasCenter ? formatDistanceSliderMi(distLocal) : "Pick a city or Near me"}
          </Text>
        </View>
        <Slider
          value={distLocal}
          onValueChange={onDistanceChange}
          min={DISTANCE_SLIDER_MIN_MI}
          max={DISTANCE_SLIDER_MAX_MI}
          step={DISTANCE_SLIDER_STEP_MI}
          disabled={!hasCenter}
        />
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
        <Icon name={stylesOpen ? "chevron-down" : "chevron-right"} size={12} color={colors.text.muted} />
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
          <Icon name="x" size={12} color={colors.text.muted} />
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
              <Icon name="search" size={28} color={colors.text.muted} />
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
