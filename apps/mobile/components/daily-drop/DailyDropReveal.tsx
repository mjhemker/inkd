import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Icon, LogoDropMark, cx } from "@inkd/ui/native";
import {
  useMarkDropClicked,
  useMarkDropSeen,
  type DailyDropCard as DailyDropCardData,
} from "@inkd/core";

import { ArtworkPlaceholder } from "../feed/ArtworkPlaceholder";
import { formatPrice } from "../feed/format";

const REVEAL_KEY = "inkd:daily-drop:revealed";

/** True when the reveal has already been shown+dismissed for `date` (YYYY-MM-DD). */
export async function hasRevealedDailyDrop(date: string): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(REVEAL_KEY);
    return stored === date;
  } catch {
    return false;
  }
}

/** Record that today's reveal has been seen so it never shows again today. */
export async function markDailyDropRevealed(date: string): Promise<void> {
  try {
    await AsyncStorage.setItem(REVEAL_KEY, date);
  } catch {
    // storage unavailable — the in-memory dismiss still holds for the session
  }
}

type Phase = "teaser" | "revealed";

export interface DailyDropRevealProps {
  card: DailyDropCardData;
  /**
   * Called when the user dismisses (from teaser or after reveal). May be async
   * (it persists today's "revealed" stamp) — the CTAs await it so the takeover
   * is fully torn down BEFORE we navigate, never left floating over the
   * destination screen.
   */
  onDismiss: () => void | Promise<void>;
}

/**
 * The Daily Drop REVEAL (mobile) — a once-a-day full-screen takeover mirroring
 * the web `DailyDropReveal`: a teaser ("Your daily drop is in" + the animated
 * INKD Drop mark) → the artwork placard (artist, style stamps, flash/original,
 * price if flash) → CTAs (view artist / view piece / dismiss). Dismissing
 * writes today's date to AsyncStorage so it never shows again that day; the
 * drop then lives on as the `DailyDropCard` atop the feed.
 */
export function DailyDropReveal({ card, onDismiss }: DailyDropRevealProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("teaser");
  const [reduced, setReduced] = useState(false);
  const seen = useMarkDropSeen();
  const clicked = useMarkDropClicked();
  const firedSeen = useRef(false);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const teaserAnim = useRef(new Animated.Value(0)).current;
  const revealAnim = useRef(new Animated.Value(0)).current;
  const haloAnim = useRef(new Animated.Value(0)).current;

  const artist = card.artist;
  const handle = artist?.handle ?? null;
  const artistName = artist?.displayName ?? (handle ? `@${handle}` : "an INKD artist");
  const isFlash = card.subjectType === "flash";
  const image = isFlash ? (card.flash?.imageUrl ?? null) : (card.post?.coverUrl ?? null);
  const styleTags = (isFlash ? card.flash?.styleTags : card.post?.styleTags) ?? [];
  const location = [artist?.city, artist?.state].filter(Boolean).join(", ");

  // Resolve reduced-motion once on mount.
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Mark the drop seen the moment the reveal is opened.
  useEffect(() => {
    if (firedSeen.current) return;
    firedSeen.current = true;
    if (!card.seenAt) seen.mutate(card.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, card.seenAt]);

  // Backdrop fade-in on mount.
  useEffect(() => {
    if (reduced) {
      backdropOpacity.setValue(1);
      teaserAnim.setValue(1);
      return;
    }
    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
    Animated.spring(teaserAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 16,
      mass: 0.9,
    }).start();
  }, [reduced, backdropOpacity, teaserAnim]);

  // Gentle halo pulse behind the teaser mark.
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(haloAnim, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(haloAnim, { toValue: 0, duration: 1300, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, haloAnim]);

  function reveal() {
    setPhase("revealed");
    if (reduced) {
      revealAnim.setValue(1);
      return;
    }
    revealAnim.setValue(0);
    Animated.spring(revealAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 16,
      mass: 0.9,
    }).start();
  }

  const stampClick = () => clicked.mutate(card.id);

  // Dismiss the takeover FIRST (stamp clicked, persist "revealed", unmount the
  // Modal), and only THEN navigate. On mobile the reveal is a RN <Modal> that
  // renders above the pushed screen, so navigating without dismissing left the
  // overlay floating over the destination — the founder-reported trap.
  async function dismissThenNavigate(go: () => void) {
    stampClick();
    await onDismiss();
    go();
  }

  function openArtist() {
    void dismissThenNavigate(() => {
      if (handle) router.push(`/artist/${handle}` as never);
    });
  }

  function openPiece() {
    void dismissThenNavigate(() => router.push("/daily-drop" as never));
  }

  const haloOpacity = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] });
  const haloScale = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDismiss}>
      <Animated.View
        style={{ opacity: backdropOpacity }}
        className="flex-1 items-center justify-center bg-black/80 px-4"
      >
        <View className="w-full max-w-md">
          {phase === "teaser" ? (
            <Animated.View
              style={{
                opacity: teaserAnim,
                transform: [
                  {
                    translateY: teaserAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                  {
                    scale: teaserAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1],
                    }),
                  },
                ],
              }}
            >
              <TeaserPanel
                haloOpacity={haloOpacity}
                haloScale={haloScale}
                onReveal={reveal}
                onDismiss={onDismiss}
              />
            </Animated.View>
          ) : (
            <Animated.View
              style={{
                opacity: revealAnim,
                transform: [
                  {
                    translateY: revealAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                  {
                    scale: revealAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              }}
            >
              <RevealedPanel
                image={image}
                subjectId={card.subjectId}
                isFlash={isFlash}
                reason={card.reason}
                artistName={artistName}
                hasArtist={!!handle}
                styleTags={styleTags.map((s) => s.name)}
                location={location}
                priceCents={card.flash?.priceCents ?? null}
                onArtist={openArtist}
                onPiece={openPiece}
                onDismiss={onDismiss}
              />
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

function TeaserPanel({
  haloOpacity,
  haloScale,
  onReveal,
  onDismiss,
}: {
  haloOpacity: Animated.AnimatedInterpolation<number>;
  haloScale: Animated.AnimatedInterpolation<number>;
  onReveal: () => void;
  onDismiss: () => void;
}) {
  return (
    <View
      className="items-center gap-6 rounded-md border border-border-accent bg-surface-base px-8 py-12"
      accessibilityRole="none"
      accessibilityLabel="Your daily drop"
    >
      <View className="items-center justify-center">
        <Animated.View
          style={{ opacity: haloOpacity, transform: [{ scale: haloScale }] }}
          className="absolute h-24 w-24 rounded-full bg-surface-ember/25"
        />
        <LogoDropMark size={84} />
      </View>

      <View className="items-center gap-2">
        <Text className="font-mono text-[11px] font-semibold uppercase tracking-widest text-content-ember">
          INKD · Daily Drop
        </Text>
        <Text className="text-center font-hand text-4xl leading-tight text-content-primary">
          Your daily drop is in
        </Text>
        <Text className="max-w-xs text-center text-sm text-content-secondary">
          One piece, picked for your taste today. Reveal it.
        </Text>
      </View>

      <Pressable
        onPress={onReveal}
        accessibilityRole="button"
        accessibilityLabel="Reveal my drop"
        className="flex-row items-center gap-2 rounded-sm bg-brand px-6 py-3 active:bg-brand-active"
      >
        <Icon name="sparkles" size={17} color="#FAFAFA" />
        <Text className="font-sans-semibold text-base text-brand-on">Reveal my drop</Text>
      </Pressable>
      <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Maybe later" hitSlop={8}>
        <Text className="font-mono text-[11px] uppercase tracking-widest text-content-muted">
          Maybe later
        </Text>
      </Pressable>
    </View>
  );
}

function RevealedPanel({
  image,
  subjectId,
  isFlash,
  reason,
  artistName,
  hasArtist,
  styleTags,
  location,
  priceCents,
  onArtist,
  onPiece,
  onDismiss,
}: {
  image: string | null;
  subjectId: string;
  isFlash: boolean;
  reason: string;
  artistName: string;
  hasArtist: boolean;
  styleTags: string[];
  location: string;
  priceCents: number | null;
  onArtist: () => void;
  onPiece: () => void;
  onDismiss: () => void;
}) {
  return (
    <View
      className="overflow-hidden rounded-md border border-border-accent bg-surface-base"
      accessibilityRole="none"
      accessibilityLabel="Today's drop"
    >
      <View className="relative aspect-[16/11] w-full bg-surface-overlay">
        {image ? (
          <Animated.Image
            source={{ uri: image }}
            className="absolute inset-0 h-full w-full"
            resizeMode="cover"
            accessibilityLabel={reason}
          />
        ) : (
          <ArtworkPlaceholder id={subjectId} className="absolute inset-0 h-full w-full" />
        )}
        <View className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-sm bg-brand px-2.5 py-1">
          <LogoDropMark size={13} />
          <Text className="font-mono text-[10px] font-bold uppercase tracking-widest text-brand-on">
            {isFlash ? "Flash drop" : "Today's drop"}
          </Text>
        </View>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={8}
          className="absolute right-3 top-3 h-8 w-8 items-center justify-center rounded-sm bg-black/45"
        >
          <Icon name="x" size={16} color="#FAFAFA" />
        </Pressable>
      </View>

      <View className="gap-4 p-5">
        <View className="gap-1.5">
          <Text className="font-mono text-[10px] font-semibold uppercase tracking-widest text-content-ember">
            Picked for you
          </Text>
          <Text className="font-hand text-2xl leading-tight text-content-primary">{reason}</Text>
        </View>

        <View className="flex-row items-center justify-between gap-3 border-t border-border-subtle pt-3">
          <View className="min-w-0 flex-1 gap-0.5">
            {hasArtist ? (
              <Pressable
                onPress={onArtist}
                hitSlop={6}
                accessibilityRole="link"
                accessibilityLabel={`View ${artistName}'s profile`}
              >
                <Text numberOfLines={1} className="font-display text-base font-bold text-content-accent">
                  {artistName}
                </Text>
              </Pressable>
            ) : (
              <Text numberOfLines={1} className="font-display text-base font-bold text-content-primary">
                {artistName}
              </Text>
            )}
            <Text numberOfLines={1} className="font-mono text-[11px] uppercase tracking-widest text-content-muted">
              {styleTags.length > 0 ? styleTags.slice(0, 2).join(" · ") : "Tattoo"}
              {location ? ` · ${location}` : ""}
            </Text>
          </View>
          {isFlash && (
            // shrink-0 keeps the plate from being squeezed; pl-3/pr-1 give the
            // script-font price glyphs room so the last digit never clips at the
            // panel's right edge (RN <Text> hard-clips to its own bounds).
            <Text className="shrink-0 pl-3 pr-1 font-hand text-2xl leading-none text-content-ember">
              {formatPrice(priceCents)}
            </Text>
          )}
        </View>

        <View className="flex-row flex-wrap items-center gap-2">
          {hasArtist && (
            <Pressable
              onPress={onArtist}
              accessibilityRole="button"
              accessibilityLabel={isFlash ? "Book this flash" : "View artist"}
              className="flex-row items-center gap-1.5 rounded-sm bg-brand px-4 py-2 active:bg-brand-active"
            >
              <Text className="font-sans-semibold text-sm text-brand-on">
                {isFlash ? "Book this flash" : "View artist"}
              </Text>
              <Icon name="arrow-right" size={15} color="#FAFAFA" />
            </Pressable>
          )}
          <Pressable
            onPress={onPiece}
            accessibilityRole="button"
            accessibilityLabel="View the piece"
            className="rounded-sm border border-border px-4 py-2 active:bg-surface-raised"
          >
            <Text className="font-sans-semibold text-sm text-content-secondary">View the piece</Text>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            hitSlop={8}
            className={cx("ml-auto")}
          >
            <Text className="font-mono text-[11px] uppercase tracking-widest text-content-muted">
              Dismiss
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
