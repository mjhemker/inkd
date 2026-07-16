import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import {
  Avatar,
  Badge,
  Button,
  Divider,
  Sheet,
  cx,
} from "@inkd/ui/native";
import {
  useToggleFollow,
  useToggleLike,
  useToggleSave,
  type FeedItem,
} from "@inkd/core";

import { ArtworkPlaceholder } from "./ArtworkPlaceholder";
import { BooksSignal } from "./BooksSignal";
import { formatPrice } from "./format";

const ICON_MUTED = "#71717A";
const ICON_ACTIVE = "#7C3AED";

export interface PostDetailSheetProps {
  item: FeedItem | null;
  onClose: () => void;
  /** Follow/like/save require an account; web disables these when signed out. */
  signedIn?: boolean;
}

/** Full lightbox for a tapped feed card — artwork, caption, artist row, actions. */
export function PostDetailSheet({ item, onClose, signedIn = true }: PostDetailSheetProps) {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();
  const toggleFollow = useToggleFollow();

  const imageUrl = item ? (item.kind === "post" ? item.coverUrl : item.imageUrl) : null;
  const handle = item?.artist.handle ?? null;
  const artistLabel =
    item?.artist.displayName || (handle ? `@${handle}` : "Artist");
  const location = item
    ? [item.artist.city, item.artist.state].filter(Boolean).join(", ")
    : "";

  return (
    <Sheet
      open={item != null}
      onClose={onClose}
      title={item?.kind === "flash" ? "Flash" : "Post"}
    >
      {item && (
        <ScrollView
          style={{ maxHeight: windowHeight * 0.72 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-4 pb-2">
            <View className="aspect-[4/5] w-full overflow-hidden rounded-sm bg-surface-overlay">
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  className="h-full w-full"
                  resizeMode="cover"
                  accessibilityLabel={
                    item.kind === "post" ? (item.caption ?? "Artwork") : (item.title ?? "Flash design")
                  }
                />
              ) : (
                <ArtworkPlaceholder id={item.id} className="h-full w-full" />
              )}
              {item.kind === "flash" && (
                <View className="absolute right-3 top-3 rounded-sm bg-surface-ember px-2 py-1">
                  <Text className="font-mono text-[11px] font-semibold text-brand-on-ember">
                    {formatPrice(item.priceCents)}
                  </Text>
                </View>
              )}
            </View>

            {item.kind === "post" && item.caption ? (
              <Text className="text-sm text-content-primary">{item.caption}</Text>
            ) : null}

            {item.kind === "flash" && item.title ? (
              <Text className="font-display text-lg text-content-primary">{item.title}</Text>
            ) : null}

            {item.styleTags.length > 0 && (
              <View className="flex-row flex-wrap gap-2">
                {item.styleTags.map((tag) => (
                  <Badge key={tag.id} variant="outline" size="sm">
                    {tag.name}
                  </Badge>
                ))}
              </View>
            )}

            <Divider />

            <View className="flex-row items-center gap-3">
              {handle ? (
                <Pressable
                  onPress={() => {
                    onClose();
                    router.push(`/artist/${handle}` as never);
                  }}
                  className="flex-1 flex-row items-center gap-3"
                  accessibilityRole="link"
                  accessibilityLabel={`View @${handle}'s profile`}
                >
                  <Avatar src={item.artist.avatarUrl ?? undefined} name={artistLabel} size="md" />
                  <View className="flex-1 gap-0.5">
                    <Text className="font-sans-semibold text-sm text-content-primary" numberOfLines={1}>
                      {artistLabel}
                    </Text>
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="font-mono text-xs text-content-muted">@{handle}</Text>
                      {location ? <Text className="text-xs text-content-muted">{location}</Text> : null}
                    </View>
                  </View>
                </Pressable>
              ) : (
                <View className="flex-1 flex-row items-center gap-3">
                  <Avatar src={item.artist.avatarUrl ?? undefined} name={artistLabel} size="md" />
                  <View className="flex-1 gap-0.5">
                    <Text className="font-sans-semibold text-sm text-content-primary" numberOfLines={1}>
                      {artistLabel}
                    </Text>
                    <View className="flex-row flex-wrap items-center gap-2">
                      {location ? <Text className="text-xs text-content-muted">{location}</Text> : null}
                    </View>
                  </View>
                </View>
              )}
              <Button
                size="sm"
                variant={item.artist.isFollowedByViewer ? "secondary" : "primary"}
                disabled={!signedIn}
                onPress={() =>
                  toggleFollow.mutate({
                    artistId: item.artist.artistId,
                    followed: !item.artist.isFollowedByViewer,
                  })
                }
                accessibilityLabel={item.artist.isFollowedByViewer ? "Unfollow artist" : "Follow artist"}
                accessibilityState={{ selected: item.artist.isFollowedByViewer }}
              >
                {item.artist.isFollowedByViewer ? "Following" : "Follow"}
              </Button>
            </View>

            <BooksSignal acceptsNewClients={item.artist.acceptsNewClients} />

            {item.kind === "post" && (
              <View className="flex-row items-center gap-4 pt-1">
                <Pressable
                  onPress={() => toggleLike.mutate({ postId: item.id, liked: !item.likedByViewer })}
                  disabled={!signedIn}
                  accessibilityRole="button"
                  accessibilityLabel={item.likedByViewer ? "Unlike this post" : "Like this post"}
                  accessibilityState={{ selected: item.likedByViewer, disabled: !signedIn }}
                  className={cx("flex-row items-center gap-1.5", !signedIn && "opacity-40")}
                >
                  <Feather name="heart" size={18} color={item.likedByViewer ? ICON_ACTIVE : ICON_MUTED} />
                  <Text className="font-mono text-xs text-content-muted">{item.likeCount}</Text>
                </Pressable>
                <Pressable
                  onPress={() => toggleSave.mutate({ postId: item.id, saved: !item.savedByViewer })}
                  disabled={!signedIn}
                  accessibilityRole="button"
                  accessibilityLabel={item.savedByViewer ? "Remove from saved" : "Save this post"}
                  accessibilityState={{ selected: item.savedByViewer, disabled: !signedIn }}
                  className={cx(!signedIn && "opacity-40")}
                >
                  <Feather name="bookmark" size={18} color={item.savedByViewer ? ICON_ACTIVE : ICON_MUTED} />
                </Pressable>
              </View>
            )}

            {imageUrl ? (
              <Button
                variant="secondary"
                onPress={() => {
                  onClose();
                  router.push(
                    `/try-on?design=${encodeURIComponent(imageUrl)}` as never,
                  );
                }}
              >
                Try it on — fit check
              </Button>
            ) : null}

            <View className="flex-row gap-3 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={!handle}
                onPress={() => {
                  if (!handle) return;
                  onClose();
                  router.push(`/artist/${handle}` as never);
                }}
              >
                View artist
              </Button>
              {item.kind === "flash" && (
                <Button
                  className="flex-1"
                  disabled={!handle || !item.isAvailable}
                  onPress={() => {
                    if (!handle) return;
                    onClose();
                    router.push(`/book/${handle}` as never);
                  }}
                >
                  Book this flash
                </Button>
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </Sheet>
  );
}
