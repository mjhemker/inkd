/**
 * Feed filter sheet (mobile) — the counterpart to the web feed filter popover.
 * Multi-select styles, location (city quick-picks + near-me), price range, and
 * a books-open toggle. Styles apply at the post level (in sync with the chip
 * row); location/price/books resolve to eligible artists via the feed RPC.
 */
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as Location from "expo-location";
import { Chip, Icon, Input, RangeSlider, Sheet, Spinner, Toggle } from "@inkd/ui/native";
import {
  DISCOVER_CITIES,
  DEFAULT_RADIUS_MI,
  milesToKm,
  formatPriceUsd,
  hasActiveFeedFilters,
  hasStyleQuery,
  PRICE_SLIDER_MIN_USD,
  PRICE_SLIDER_MAX_USD,
  PRICE_SLIDER_STEP_USD,
  type FeedFilterState,
  type Style,
} from "@inkd/core";
import { useTheme } from "@/providers/theme";

const COMMIT_DEBOUNCE_MS = 260;

export function FeedFilterSheet({
  open,
  filter,
  styles,
  onChange,
  onReset,
  onClose,
}: {
  open: boolean;
  filter: FeedFilterState;
  styles: Style[];
  onChange: (next: FeedFilterState) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const patch = (p: Partial<FeedFilterState>) => onChange({ ...filter, ...p });
  const activeStyles = new Set(filter.styles);
  const nearMeActive = filter.lat != null && filter.lng != null && !filter.city;
  const [locating, setLocating] = useState(false);

  const [priceLocal, setPriceLocal] = useState<[number, number]>([
    filter.priceMinUsd ?? PRICE_SLIDER_MIN_USD,
    filter.priceMaxUsd ?? PRICE_SLIDER_MAX_USD,
  ]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setPriceLocal([filter.priceMinUsd ?? PRICE_SLIDER_MIN_USD, filter.priceMaxUsd ?? PRICE_SLIDER_MAX_USD]);
  }, [filter.priceMinUsd, filter.priceMaxUsd]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const onPriceChange = ([lo, hi]: [number, number]) => {
    setPriceLocal([lo, hi]);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () =>
        onChange({
          ...filter,
          priceMinUsd: lo > PRICE_SLIDER_MIN_USD ? lo : undefined,
          priceMaxUsd: hi < PRICE_SLIDER_MAX_USD ? hi : undefined,
        }),
      COMMIT_DEBOUNCE_MS,
    );
  };

  const toggleStyle = (slug: string) => {
    const next = new Set(activeStyles);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    patch({ styles: [...next] });
  };

  // "Other" — a free-text style query for anything outside the taxonomy.
  const [otherOpen, setOtherOpen] = useState(hasStyleQuery(filter));
  const [otherLocal, setOtherLocal] = useState(filter.styleQuery ?? "");
  const otherTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setOtherLocal(filter.styleQuery ?? "");
  }, [filter.styleQuery]);
  useEffect(() => () => { if (otherTimerRef.current) clearTimeout(otherTimerRef.current); }, []);

  const toggleOther = () => {
    if (otherOpen) {
      setOtherOpen(false);
      setOtherLocal("");
      patch({ styleQuery: undefined });
    } else {
      setOtherOpen(true);
    }
  };

  const onOtherChange = (value: string) => {
    setOtherLocal(value);
    if (otherTimerRef.current) clearTimeout(otherTimerRef.current);
    otherTimerRef.current = setTimeout(
      () => patch({ styleQuery: value.trim() || undefined }),
      COMMIT_DEBOUNCE_MS,
    );
  };

  const pickCity = (slug: string) => {
    const city = DISCOVER_CITIES.find((c) => c.slug === slug);
    if (!city) return;
    if (filter.city === slug) {
      patch({ city: undefined, lat: undefined, lng: undefined, state: undefined, radiusKm: undefined });
    } else {
      patch({
        city: city.slug,
        lat: city.lat,
        lng: city.lng,
        state: city.state,
        radiusKm: filter.radiusKm ?? milesToKm(DEFAULT_RADIUS_MI),
      });
    }
  };

  const useMyLocation = async () => {
    if (nearMeActive) {
      patch({ lat: undefined, lng: undefined, radiusKm: undefined });
      return;
    }
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      patch({
        city: undefined,
        state: undefined,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        radiusKm: filter.radiusKm ?? milesToKm(DEFAULT_RADIUS_MI),
      });
    } catch {
      /* ignore — user can pick a city */
    } finally {
      setLocating(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Filters">
      <ScrollView className="max-h-[70vh]" showsVerticalScrollIndicator={false}>
        {/* Location */}
        <Text className="pb-2 font-mono text-[10px] uppercase tracking-widest text-content-muted">Location</Text>
        <View className="flex-row flex-wrap gap-2">
          <Chip selected={nearMeActive} onPress={useMyLocation} disabled={locating}>
            <View className="flex-row items-center gap-1">
              {locating ? <Spinner size="small" /> : <Icon name="compass" size={13} color={nearMeActive ? "#FFFFFF" : colors.text.muted} />}
              <Text className={nearMeActive ? "text-brand-on" : "text-content-secondary"}>Near me</Text>
            </View>
          </Chip>
          {DISCOVER_CITIES.map((c) => (
            <Chip key={c.slug} selected={filter.city === c.slug} onPress={() => pickCity(c.slug)}>
              {c.label}
            </Chip>
          ))}
        </View>

        {/* Price */}
        <View className="mt-4 flex-row items-center justify-between">
          <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">Price</Text>
          <Text className="font-mono text-xs text-content-secondary">
            {formatPriceUsd(priceLocal[0])} – {formatPriceUsd(priceLocal[1])}
          </Text>
        </View>
        <View className="mt-1">
          <RangeSlider
            value={priceLocal}
            onValueChange={onPriceChange}
            min={PRICE_SLIDER_MIN_USD}
            max={PRICE_SLIDER_MAX_USD}
            step={PRICE_SLIDER_STEP_USD}
          />
        </View>

        {/* Books open */}
        <View className="mt-4 flex-row items-center justify-between">
          <Text className="text-sm text-content-secondary">Open books only</Text>
          <Toggle checked={filter.booksOpen} onCheckedChange={(v) => patch({ booksOpen: v })} />
        </View>

        {/* Styles */}
        <Text className="mb-2 mt-4 font-mono text-[10px] uppercase tracking-widest text-content-muted">
          Styles{filter.styles.length > 0 ? ` · ${filter.styles.length}` : ""}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {styles.map((s) => (
            <Chip key={s.slug} selected={activeStyles.has(s.slug)} onPress={() => toggleStyle(s.slug)}>
              {s.name}
            </Chip>
          ))}
          <Chip selected={otherOpen} onPress={toggleOther}>
            Other
          </Chip>
        </View>
        {otherOpen && (
          <Input
            size="sm"
            value={otherLocal}
            onChangeText={onOtherChange}
            placeholder="e.g. Chicano, dotwork…"
            autoFocus
            accessibilityLabel="Other style — search by name"
            className="mt-2"
          />
        )}
      </ScrollView>

      {/* Footer */}
      <View className="mt-4 flex-row items-center justify-between border-t border-border-subtle pt-3">
        <Pressable onPress={onReset} disabled={!hasActiveFeedFilters(filter)} hitSlop={8}>
          <Text className={hasActiveFeedFilters(filter) ? "font-mono text-xs uppercase tracking-wider text-content-muted" : "font-mono text-xs uppercase tracking-wider text-content-muted opacity-40"}>
            Clear all
          </Text>
        </Pressable>
        <Pressable onPress={onClose} className="rounded-sm bg-brand px-5 py-2 active:opacity-90">
          <Text className="font-sans-semibold text-sm text-brand-on">Done</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
