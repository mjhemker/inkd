import { router } from "expo-router";
import { Image, Text, View } from "react-native";
import { Button, EmptyState, Icon, Skeleton } from "@inkd/ui/native";
import { useArtistPosts, type Post } from "@inkd/core";
import { useTheme } from "@/providers/theme";

export function PostsPanel({ artistId }: { artistId: string; userId: string }) {
  const { colors } = useTheme();
  const { data: posts, isLoading } = useArtistPosts(artistId);

  // Creating a post is now a full-screen progressive flow (app/create/post).
  const openAddFlow = () => router.push("/create/post");

  return (
    <View className="gap-4">
      <View className="gap-3">
        <Text className="text-sm text-content-muted">
          Photos and updates for your feed — the fastest way to show new work.
        </Text>
        {/* This tab's single action → the one hero on the screen. */}
        <Button hero className="w-full" leadingIcon={<Icon name="plus" size={16} color="#FAFAFA" />} onPress={openAddFlow}>
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
            <Button size="sm" onPress={openAddFlow}>
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
