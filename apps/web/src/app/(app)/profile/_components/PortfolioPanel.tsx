"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  FormField,
  Icon,
  Input,
  Modal,
  TextArea,
  Toggle,
  useToast,
} from "@inkd/ui/web";
import {
  usePortfolioMutations,
  usePortfolioPieces,
  useStyles,
  type PortfolioPiece,
} from "@inkd/core";
import { ImageUploadField } from "./ImageUploadField";

export function PortfolioPanel({ artistId, userId }: { artistId: string; userId: string }) {
  const { data: pieces, isLoading } = usePortfolioPieces(artistId);
  const mutations = usePortfolioMutations(artistId);
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PortfolioPiece | null>(null);

  const ordered = pieces ?? [];
  const orderedIds = ordered.map((p) => p.id);

  function move(id: string, direction: -1 | 1) {
    const index = orderedIds.indexOf(id);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= orderedIds.length) return;
    const next = [...orderedIds];
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item!);
    mutations.reorder.mutate(next);
  }

  async function setCover(id: string) {
    try {
      await mutations.setCover.mutateAsync({ pieceId: id, currentOrderedIds: orderedIds });
      toast({ title: "Cover updated", variant: "success" });
    } catch {
      toast({ title: "Couldn't set cover", variant: "danger" });
    }
  }

  async function remove(id: string) {
    try {
      await mutations.remove.mutateAsync(id);
    } catch {
      toast({ title: "Couldn't delete piece", variant: "danger" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-content-muted">
          Your curated body of work — the first piece is your public cover image.
        </p>
        <Button size="sm" leadingIcon={<Icon name="plus" size={16} />} onClick={() => setCreateOpen(true)}>
          Add piece
        </Button>
      </div>

      {isLoading ? (
        <GridSkeleton />
      ) : ordered.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-surface-raised/40">
          <EmptyState
            icon={<Icon name="layout-grid" size={26} />}
            title="Your portfolio is empty"
            description="Upload healed work, in-progress shots, or your best flash to build out your gallery."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Add your first piece
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {ordered.map((piece, index) => (
            <PieceCard
              key={piece.id}
              piece={piece}
              isCover={index === 0}
              onMoveLeft={index > 0 ? () => move(piece.id, -1) : undefined}
              onMoveRight={index < ordered.length - 1 ? () => move(piece.id, 1) : undefined}
              onSetCover={index !== 0 ? () => setCover(piece.id) : undefined}
              onEdit={() => setEditing(piece)}
              onDelete={() => remove(piece.id)}
            />
          ))}
        </div>
      )}

      <PieceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        artistId={artistId}
        userId={userId}
        mode="create"
      />
      <PieceModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        artistId={artistId}
        userId={userId}
        mode="edit"
        piece={editing}
      />
    </div>
  );
}

function PieceCard({
  piece,
  isCover,
  onMoveLeft,
  onMoveRight,
  onSetCover,
  onEdit,
  onDelete,
}: {
  piece: PortfolioPiece;
  isCover: boolean;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onSetCover?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card padding="none" className="group relative overflow-hidden">
      <div className="relative aspect-square bg-surface-overlay">
        {piece.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={piece.image_url}
            alt={piece.title ?? ""}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-content-muted">
            <Icon name="image" size={22} />
          </div>
        )}
        {isCover && (
          <Badge variant="brand" size="sm" className="absolute left-2 top-2">
            Cover
          </Badge>
        )}
        <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-2 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
          <div className="flex justify-end gap-1">
            <IconAction icon="x" label="Delete" onClick={onDelete} />
          </div>
          <div className="flex items-end justify-between gap-1">
            <div className="flex gap-1">
              {onMoveLeft && <IconAction icon="chevron-left" label="Move earlier" onClick={onMoveLeft} />}
              {onMoveRight && <IconAction icon="chevron-right" label="Move later" onClick={onMoveRight} />}
            </div>
            <div className="flex gap-1">
              {onSetCover && <IconAction icon="star" label="Set as cover" onClick={onSetCover} />}
              <IconAction icon="settings" label="Edit" onClick={onEdit} />
            </div>
          </div>
        </div>
      </div>
      {piece.title && (
        <p className="truncate p-2 text-xs font-medium text-content-secondary">{piece.title}</p>
      )}
    </Card>
  );
}

function IconAction({
  icon,
  label,
  onClick,
}: {
  icon: "x" | "chevron-left" | "chevron-right" | "star" | "settings";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-content-primary outline-none transition-colors hover:bg-brand"
    >
      <Icon name={icon} size={14} />
    </button>
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

function PieceModal({
  open,
  onClose,
  artistId,
  userId,
  mode,
  piece,
}: {
  open: boolean;
  onClose: () => void;
  artistId: string;
  userId: string;
  mode: "create" | "edit";
  piece?: PortfolioPiece | null;
}) {
  const { toast } = useToast();
  const { data: styles } = useStyles();
  const mutations = usePortfolioMutations(artistId);

  const [imageUrl, setImageUrl] = useState(piece?.image_url ?? "");
  const [title, setTitle] = useState(piece?.title ?? "");
  const [description, setDescription] = useState(piece?.description ?? "");
  const [placement, setPlacement] = useState(piece?.placement ?? "");
  const [isHealed, setIsHealed] = useState(piece?.is_healed ?? false);
  const [isPublic, setIsPublic] = useState(piece?.is_public ?? true);
  const [tags, setTags] = useState<string[]>(piece?.style_tags ?? []);

  // Re-seed local state whenever the target piece changes (edit) or the
  // modal re-opens fresh (create).
  const key = piece?.id ?? "new";
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setImageUrl(piece?.image_url ?? "");
    setTitle(piece?.title ?? "");
    setDescription(piece?.description ?? "");
    setPlacement(piece?.placement ?? "");
    setIsHealed(piece?.is_healed ?? false);
    setIsPublic(piece?.is_public ?? true);
    setTags(piece?.style_tags ?? []);
  }

  async function handleSubmit() {
    if (!imageUrl) {
      toast({ title: "Add a photo first", variant: "danger" });
      return;
    }
    try {
      if (mode === "create") {
        await mutations.create.mutateAsync({
          image_url: imageUrl,
          title: title.trim() || null,
          description: description.trim() || null,
          placement: placement.trim() || null,
          is_healed: isHealed,
          is_public: isPublic,
          style_tags: tags,
        });
        toast({ title: "Added to portfolio", variant: "success" });
      } else if (piece) {
        await mutations.update.mutateAsync({
          id: piece.id,
          patch: {
            image_url: imageUrl,
            title: title.trim() || null,
            description: description.trim() || null,
            placement: placement.trim() || null,
            is_healed: isHealed,
            is_public: isPublic,
            style_tags: tags,
          },
        });
        toast({ title: "Piece updated", variant: "success" });
      }
      onClose();
    } catch (err) {
      toast({
        title: "Couldn't save piece",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  const saving = mutations.create.isPending || mutations.update.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Add portfolio piece" : "Edit piece"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {mode === "create" ? "Add to portfolio" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
        <ImageUploadField userId={userId} folder="portfolio" value={imageUrl} onChange={setImageUrl} />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Placement">
            <Input
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
              placeholder="Forearm, ribs, calf…"
            />
          </FormField>
        </div>
        <FormField label="Description">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </FormField>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-content-primary">Styles</span>
          <div className="flex flex-wrap gap-2">
            {(styles ?? []).map((style) => (
              <Chip
                key={style.id}
                selected={tags.includes(style.slug)}
                onClick={() =>
                  setTags((prev) =>
                    prev.includes(style.slug)
                      ? prev.filter((t) => t !== style.slug)
                      : [...prev, style.slug],
                  )
                }
              >
                {style.name}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <Toggle checked={isHealed} onCheckedChange={setIsHealed} label="Fully healed" />
          <Toggle checked={isPublic} onCheckedChange={setIsPublic} label="Visible on my public profile" />
        </div>
      </div>
    </Modal>
  );
}
