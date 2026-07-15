"use client";

import { useState } from "react";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  Modal,
  TextArea,
  Toggle,
  useToast,
} from "@inkd/ui/web";
import { useArtistPosts, usePostMutations, useStyles, type Post } from "@inkd/core";
import { ImageUploadField } from "./ImageUploadField";

export function PostsPanel({ artistId, userId }: { artistId: string; userId: string }) {
  const { data: posts, isLoading } = useArtistPosts(artistId);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-content-muted">
          Photos and updates for your feed — the fastest way to show new work.
        </p>
        <Button size="sm" leadingIcon={<Icon name="plus" size={16} />} onClick={() => setOpen(true)}>
          New post
        </Button>
      </div>

      {isLoading ? (
        <GridSkeleton />
      ) : !posts || posts.length === 0 ? (
        <EmptyPosts onCreate={() => setOpen(true)} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      <NewPostModal
        open={open}
        onClose={() => setOpen(false)}
        artistId={artistId}
        userId={userId}
      />
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const cover =
    post.cover_url ?? (Array.isArray(post.media) && (post.media[0] as { url?: string } | undefined)?.url);
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="relative aspect-square bg-surface-overlay">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-content-muted">
            <Icon name="image" size={22} />
          </div>
        )}
        {!post.is_public && (
          <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-content-secondary">
            Private
          </span>
        )}
      </div>
      {post.caption && (
        <p className="line-clamp-2 p-2.5 text-xs text-content-secondary">{post.caption}</p>
      )}
    </Card>
  );
}

function EmptyPosts({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-raised/40">
      <EmptyState
        icon={<Icon name="image" size={26} />}
        title="No posts yet"
        description="Share fresh work, healed shots, or studio updates with your followers."
        action={
          <Button size="sm" onClick={onCreate}>
            Create your first post
          </Button>
        }
      />
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface-overlay" />
      ))}
    </div>
  );
}

function NewPostModal({
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
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New post"
      description="Goes to your feed and (if public) the discovery feed."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={mutations.create.isPending}>
            Post
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ImageUploadField userId={userId} folder="posts" value={imageUrl} onChange={setImageUrl} />
        <TextArea
          placeholder="Write a caption…"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-content-primary">Style tags</span>
          <div className="flex flex-wrap gap-2">
            {(styles ?? []).map((style) => (
              <Chip
                key={style.id}
                selected={styleIds.includes(style.id)}
                onClick={() =>
                  setStyleIds((prev) =>
                    prev.includes(style.id)
                      ? prev.filter((id) => id !== style.id)
                      : [...prev, style.id],
                  )
                }
              >
                {style.name}
              </Chip>
            ))}
          </div>
        </div>
        <Toggle checked={isPublic} onCheckedChange={setIsPublic} label="Visible on my public profile" />
      </div>
    </Modal>
  );
}
