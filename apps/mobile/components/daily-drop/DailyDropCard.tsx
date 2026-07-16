import { useEffect, useRef } from "react";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import { Button, Card, Icon, cx } from "@inkd/ui/native";
import {
  useDropReact,
  useMarkDropClicked,
  useMarkDropSeen,
  type DailyDropCard as DailyDropCardData,
} from "@inkd/core";

import { ArtworkPlaceholder } from "../feed/ArtworkPlaceholder";
import { formatPrice, placardLine } from "../feed/format";

const ICON_MUTED = "#71717A";
const ICON_ACTIVE = "#7C3AED";
const ICON_INK = "#FAFAFA";

export interface DailyDropCardProps {
  card: DailyDropCardData;
  /** "feed" renders compactly atop the discovery feed; "full" is the fuller
   * treatment on the dedicated Daily Drop screen. */
  variant?: "feed" | "full";
  /** Like/save require an account; web disables these when signed out. */
  signedIn?: boolean;
}

/**
 * The Daily Drop card — a personalized daily pick (post or flash), visually
 * elevated above a normal `FeedCard`: an ember eyebrow, the artwork, the
 * artist byline, and the "why" reason line front and center. Stamps `seenAt`
 * once when a real card first renders, and `clickedAt` when the artwork or
 * artist link is opened.
 */
export function DailyDropCard({ card, variant = "feed", signedIn = true }: DailyDropCardProps) {
  const router = useRouter();
  const markSeen = useMarkDropSeen();
  const markClicked = useMarkDropClicked();
  const dropReact = useDropReact();

  // Fire "seen" once per card id — guards StrictMode double-invoke and re-renders.
  const seenForId = useRef<string | null>(null);
  useEffect(() => {
    if (seenForId.current === card.id) return;
    seenForId.current = card.id;
    markSeen.mutate(card.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const handle = card.artist?.handle ?? null;
  const artistLabel = card.artist?.displayName || (handle ? `@${handle}` : "INKD artist");
  const placard = placardLine({
    styleNames: (card.post?.styleTags ?? card.flash?.styleTags ?? []).map((t) => t.name),
    handle: null,
    city: card.artist?.city ?? null,
    state: card.artist?.state ?? null,
  });

  const imageUrl = card.subjectType === "post" ? (card.post?.coverUrl ?? null) : (card.flash?.imageUrl ?? null);
  const imageLabel =
    card.subjectType === "post" ? (card.post?.caption ?? "Artwork") : (card.flash?.title ?? "Flash design");

  function openArtist() {
    markClicked.mutate(card.id);
    if (handle) router.push(`/artist/${handle}` as never);
  }

  const isFull = variant === "full";

  return (
    <Card
      variant="raised"
      padding="none"
      className="overflow-hidden border border-border-accent"
    >
      <View className="flex-row items-center gap-1.5 border-b border-border-subtle bg-surface-ember px-3 py-2">
        <Icon name="sparkles" size={12} color={ICON_INK} />
        <Text className="font-mono text-[10px] font-semibold uppercase tracking-widest text-brand-on-ember">
          Today&apos;s Drop
        </Text>
      </View>

      <Pressable
        onPress={openArtist}
        accessibilityRole="button"
        accessibilityLabel={handle ? `View @${handle}'s profile` : "View artist"}
      >
        <View className={cx("w-full bg-surface-overlay", isFull ? "aspect-[4/5]" : "aspect-[16/10]")}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              className="h-full w-full"
              resizeMode="cover"
              accessibilityLabel={imageLabel}
            />
          ) : (
            <ArtworkPlaceholder id={card.id} className="h-full w-full" />
          )}

          {card.subjectType === "flash" && (
            <>
              <View className="absolute left-3 top-3 rounded-sm bg-surface-ember px-2 py-1">
                <Text className="font-mono text-[10px] font-semibold uppercase tracking-widest text-brand-on-ember">
                  Flash
                </Text>
              </View>
              <View className="absolute right-3 top-3 rounded-sm bg-surface-ember px-2 py-1">
                <Text className="font-mono text-[11px] font-semibold text-brand-on-ember">
                  {formatPrice(card.flash?.priceCents)}
                </Text>
              </View>
            </>
          )}
        </View>
      </Pressable>

      <View className="gap-2.5 px-3 py-3">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 flex-row flex-wrap items-baseline gap-x-1.5">
            <Text
              numberOfLines={1}
              className="font-mono text-[11px] uppercase tracking-widest text-content-secondary"
            >
              {placard}
            </Text>
            {handle && (
              <Pressable
                onPress={openArtist}
                hitSlop={6}
                accessibilityRole="link"
                accessibilityLabel={`View @${handle}'s profile`}
              >
                <Text
                  numberOfLines={1}
                  className="font-mono text-[11px] uppercase tracking-widest text-content-accent"
                >
                  @{handle}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {!card.artist && (
          <Text className="font-mono text-[11px] uppercase tracking-widest text-content-muted">
            {artistLabel}
          </Text>
        )}

        <Text className={cx("font-hand text-brand", isFull ? "text-xl leading-6" : "text-lg leading-5")}>
          {card.reason}
        </Text>

        {card.subjectType === "post" ? (
          <View className="flex-row items-center gap-2 pt-1">
            <Button size="sm" variant="secondary" className="flex-1" onPress={openArtist}>
              View artist
            </Button>
            {card.post && (
              <>
                <Pressable
                  onPress={() =>
                    dropReact.mutate({
                      dropId: card.id,
                      postId: card.subjectId,
                      action: "like",
                      on: !card.post!.likedByViewer,
                    })
                  }
                  disabled={!signedIn}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={card.post.likedByViewer ? "Unlike this post" : "Like this post"}
                  accessibilityState={{ selected: card.post.likedByViewer, disabled: !signedIn }}
                  className={cx(
                    "h-9 w-9 items-center justify-center rounded-sm border border-border-subtle",
                    !signedIn && "opacity-40",
                  )}
                >
                  <Feather
                    name="heart"
                    size={16}
                    color={card.post.likedByViewer ? ICON_ACTIVE : ICON_MUTED}
                  />
                </Pressable>
                <Pressable
                  onPress={() =>
                    dropReact.mutate({
                      dropId: card.id,
                      postId: card.subjectId,
                      action: "save",
                      on: !card.post!.savedByViewer,
                    })
                  }
                  disabled={!signedIn}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={card.post.savedByViewer ? "Remove from saved" : "Save this post"}
                  accessibilityState={{ selected: card.post.savedByViewer, disabled: !signedIn }}
                  className={cx(
                    "h-9 w-9 items-center justify-center rounded-sm border border-border-subtle",
                    !signedIn && "opacity-40",
                  )}
                >
                  <Feather
                    name="bookmark"
                    size={16}
                    color={card.post.savedByViewer ? ICON_ACTIVE : ICON_MUTED}
                  />
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <View className="flex-row items-center justify-between gap-2 pt-1">
            <Text
              className={cx(
                "font-mono text-[10px] uppercase tracking-widest",
                card.flash?.isAvailable ? "text-success-500" : "text-content-muted",
              )}
            >
              {card.flash?.isAvailable ? "Available" : "Claimed"}
            </Text>
            <Button
              size="sm"
              variant="secondary"
              disabled={!card.flash?.isAvailable || !handle}
              onPress={() => {
                if (handle) router.push(`/book/${handle}` as never);
              }}
              accessibilityLabel="Book this flash"
            >
              Book this flash
            </Button>
          </View>
        )}

        <Pressable onPress={() => router.push("/try-on" as never)} hitSlop={6}>
          <Text className="font-mono text-[11px] uppercase tracking-widest text-content-accent">
            Try it on &rarr;
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}
