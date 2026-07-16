import { useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import {
  Button,
  Chip,
  EmptyState,
  Icon,
  Sheet,
  Skeleton,
  TextArea,
  Toggle,
  useToast,
} from "@inkd/ui/native";
import { useArtistPosts, usePostMutations, useStyles, type Post } from "@inkd/core";
import { useTheme } from "@/providers/theme";
import { ImageUploadField } from "./ImageUploadField";

export function PostsPanel({ artistId, userId }: { artistId: string; userId: string }) {
  const { colors } = useTheme();
  const { data: posts, isLoading } = useArtistPosts(artistId);
  const [open, setOpen] = useState(false);

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 pr-3 text-sm text-content-muted">
          Photos and updates for your feed.
        </Text>
        <Button size="sm" leadingIcon={<Icon name="plus" size={16} color="#FAFAFA" />} onPress={() => setOpen(true)}>
          New post
        </Button>
      </View>

      {isLoading ? (
        <GridSkeleton />
      ) : !posts || posts.length === 0 ? (
        <EmptyState
          icon={<Icon name="image" size={28} color={colors.text.muted} />}
          title="No posts yet"
          description="Share fresh work or studio updates with your followers."
          action={
            <Button size="sm" onPress={() => setOpen(true)}>
              Create your first post
            </Button>
          }
        />
      ) : (
        <View className="flex-row flex-wrap gap-2.5">
          {posts.map((post) => (
            <PostTile key={post.id} post={post} />
          ))}
        </View>
      )}

      <NewPostSheet open={open} onClose={() => setOpen(false)} artistId={artistId} userId={userId} />
    </View>
  );
}

function PostTile({ post }: { post: Post }) {
  const { colors } = useTheme();
  const cover =
    post.cover_url ?? (Array.isArray(post.media) && (post.media[0] as { url?: string } | undefined)?.url);
  return (
    <View className="aspect-square w-[31%] overflow-hidden rounded-xl bg-surface-overlay">
      {cover ? (
        <Image source={{ uri: cover }} className="h-full w-full" resizeMode="cover" />
      ) : (
        <View className="h-full w-full items-center justify-center">
          <Icon name="image" size={18} color={colors.text.muted} />
        </View>
      )}
    </View>
  );
}

function GridSkeleton() {
  return (
    <View className="flex-row flex-wrap gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square w-[31%]" />
      ))}
    </View>
  );
}

function NewPostSheet({
  open,
  onClose,
  artistId,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  artistId: string;
  userId: string;
}) {
  const { toast } = useToast();
  const { data: styles } = useStyles();
  const mutations = usePostMutations(artistId);
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [styleIds, setStyleIds] = useState<string[]>([]);

  function reset() {
    setImageUrl("");
    setCaption("");
    setIsPublic(true);
    setStyleIds([]);
  }

  async function handleCreate() {
    if (!imageUrl) {
      toast({ title: "Add a photo first", variant: "danger" });
      return;
    }
    try {
      const post = await mutations.create.mutateAsync({
        caption: caption.trim() || null,
        media: [{ url: imageUrl }],
        cover_url: imageUrl,
        is_public: isPublic,
        source: "inkd",
      });
      if (styleIds.length > 0) {
        await mutations.setStyles.mutateAsync({ postId: post.id, styleIds });
      }
      toast({ title: "Post published", variant: "success" });
      reset();
      onClose();
    } catch (err) {
      toast({
        title: "Couldn't create post",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="New post">
      <ScrollView className="max-h-[70vh]" showsVerticalScrollIndicator={false}>
        <View className="gap-4 pb-4">
          <ImageUploadField userId={userId} folder="posts" value={imageUrl} onChange={setImageUrl} />
          <TextArea placeholder="Write a caption…" value={caption} onChangeText={setCaption} numberOfLines={3} />
          <View className="gap-2">
            <Text className="text-sm font-medium text-content-primary">Style tags</Text>
            <View className="flex-row flex-wrap gap-2">
              {(styles ?? []).map((style) => (
                <Chip
                  key={style.id}
                  selected={styleIds.includes(style.id)}
                  onPress={() =>
                    setStyleIds((prev) =>
                      prev.includes(style.id) ? prev.filter((id) => id !== style.id) : [...prev, style.id],
                    )
                  }
                >
                  {style.name}
                </Chip>
              ))}
            </View>
          </View>
          <Toggle checked={isPublic} onCheckedChange={setIsPublic} label="Visible on my public profile" />
          <View className="flex-row gap-3 pt-2">
            <Button variant="secondary" onPress={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onPress={handleCreate} loading={mutations.create.isPending} className="flex-1">
              Post
            </Button>
          </View>
        </View>
      </ScrollView>
    </Sheet>
  );
}
