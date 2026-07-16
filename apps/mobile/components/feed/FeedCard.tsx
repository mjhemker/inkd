import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import { Button, Card, cx } from "@inkd/ui/native";
import {
  useToggleLike,
  useToggleSave,
  type FeedItem,
} from "@inkd/core";

import { ArtworkPlaceholder } from "./ArtworkPlaceholder";
import { BooksSignal } from "./BooksSignal";
import { formatPrice, placardLine } from "./format";

const ICON_MUTED = "#71717A";
const ICON_ACTIVE = "#7C3AED";

export interface FeedCardProps {
  item: FeedItem;
  onOpen: (item: FeedItem) => void;
  /** Like/save require an account; web disables these when signed out. */
  signedIn?: boolean;
}

/** A single feed card — post or flash variant, artwork-forward with a museum placard. */
export function FeedCard({ item, onOpen, signedIn = true }: FeedCardProps) {
  const router = useRouter();
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();

  const imageUrl = item.kind === "post" ? item.coverUrl : item.imageUrl;
  const handle = item.artist.handle;
  // Style + location only — the handle is rendered separately below as its
  // own pressable link so it can navigate to the artist profile.
  const placard = placardLine({
    styleNames: item.styleTags.map((t) => t.name),
    handle: null,
    city: item.artist.city,
    state: item.artist.state,
  });

  return (
    <Card
      variant="interactive"
      padding="none"
      className="overflow-hidden"
      onPress={() => onOpen(item)}
      accessibilityLabel={item.kind === "flash" ? "View flash details" : "View post details"}
    >
      <View className="aspect-[4/5] w-full bg-surface-overlay">
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            className="h-full w-full"
            resizeMode="cover"
            accessibilityLabel={item.kind === "post" ? (item.caption ?? "Artwork") : (item.title ?? "Flash design")}
          />
        ) : (
          <ArtworkPlaceholder id={item.id} className="h-full w-full" />
        )}

        {item.kind === "flash" && (
          <>
            <View className="absolute left-3 top-3 rounded-sm bg-surface-ember px-2 py-1">
              <Text className="font-mono text-[10px] font-semibold uppercase tracking-widest text-brand-on-ember">
                Flash
              </Text>
            </View>
            <View className="absolute right-3 top-3 rounded-sm bg-surface-ember px-2 py-1">
              <Text className="font-mono text-[11px] font-semibold text-brand-on-ember">
                {formatPrice(item.priceCents)}
              </Text>
            </View>
          </>
        )}
      </View>

      <View className="gap-2 border-t border-border-subtle bg-surface-overlay px-3 py-2.5">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 flex-row flex-wrap items-baseline gap-x-1.5">
            {(placard !== "INKD ARTIST" || !handle) && (
              <Text
                numberOfLines={1}
                className="font-mono text-[11px] uppercase tracking-widest text-content-secondary"
              >
                {placard}
              </Text>
            )}
            {handle && (
              <Pressable
                onPress={() => router.push(`/artist/${handle}` as never)}
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
          <BooksSignal acceptsNewClients={item.artist.acceptsNewClients} />
        </View>

        {item.kind === "post" ? (
          <View className="flex-row items-center gap-4 pt-0.5">
            <Pressable
              onPress={() => toggleLike.mutate({ postId: item.id, liked: !item.likedByViewer })}
              disabled={!signedIn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={item.likedByViewer ? "Unlike this post" : "Like this post"}
              accessibilityState={{ selected: item.likedByViewer, disabled: !signedIn }}
              className={cx("flex-row items-center gap-1.5", !signedIn && "opacity-40")}
            >
              <Feather
                name="heart"
                size={16}
                color={item.likedByViewer ? ICON_ACTIVE : ICON_MUTED}
              />
              <Text className="font-mono text-xs text-content-muted">{item.likeCount}</Text>
            </Pressable>
            <Pressable
              onPress={() => toggleSave.mutate({ postId: item.id, saved: !item.savedByViewer })}
              disabled={!signedIn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={item.savedByViewer ? "Remove from saved" : "Save this post"}
              accessibilityState={{ selected: item.savedByViewer, disabled: !signedIn }}
              className={cx(!signedIn && "opacity-40")}
            >
              <Feather
                name="bookmark"
                size={16}
                color={item.savedByViewer ? ICON_ACTIVE : ICON_MUTED}
              />
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-center justify-between gap-2 pt-0.5">
            <Text
              className={cx(
                "font-mono text-[10px] uppercase tracking-widest",
                item.isAvailable ? "text-success-500" : "text-content-muted",
              )}
            >
              {item.isAvailable ? "Available" : "Claimed"}
            </Text>
            <Button
              size="sm"
              variant="secondary"
              disabled={!item.isAvailable || !item.artist.handle}
              onPress={() => {
                if (item.artist.handle) {
                  router.push(`/book/${item.artist.handle}` as never);
                }
              }}
              accessibilityLabel="Book this flash"
            >
              Book this flash
            </Button>
          </View>
        )}
      </View>
    </Card>
  );
}
