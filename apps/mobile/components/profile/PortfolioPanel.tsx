import { useState } from "react";
import { router } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  FormField,
  Icon,
  Input,
  Sheet,
  Skeleton,
  TextArea,
  Toggle,
  useToast,
} from "@inkd/ui/native";
import {
  usePortfolioMutations,
  usePortfolioPieces,
  useStyles,
  type PortfolioPiece,
} from "@inkd/core";
import { useTheme } from "@/providers/theme";
import { ImageUploadField } from "./ImageUploadField";

export function PortfolioPanel({ artistId, userId }: { artistId: string; userId: string }) {
  const { colors } = useTheme();
  const { data: pieces, isLoading } = usePortfolioPieces(artistId);
  const mutations = usePortfolioMutations(artistId);
  const { toast } = useToast();
  const [editing, setEditing] = useState<PortfolioPiece | null>(null);

  // Adding a piece is now a full-screen progressive flow (app/create/portfolio).
  const openAddFlow = () => router.push("/create/portfolio");

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

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 pr-3 text-sm text-content-muted">
          The first piece is your public cover image.
        </Text>
        <Button size="sm" leadingIcon={<Icon name="plus" size={16} color="#FAFAFA" />} onPress={openAddFlow}>
          Add
        </Button>
      </View>

      {isLoading ? (
        <View className="flex-row flex-wrap gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-[31%]" />
          ))}
        </View>
      ) : ordered.length === 0 ? (
        <EmptyState
          icon={<Icon name="layout-grid" size={28} color={colors.text.muted} />}
          title="Your portfolio is empty"
          description="Upload healed work or your best flash to build out your gallery."
          action={
            <Button size="sm" onPress={openAddFlow}>
              Add your first piece
            </Button>
          }
        />
      ) : (
        <View className="gap-2.5">
          {ordered.map((piece, index) => (
            <PieceRow
              key={piece.id}
              piece={piece}
              isCover={index === 0}
              onMoveUp={index > 0 ? () => move(piece.id, -1) : undefined}
              onMoveDown={index < ordered.length - 1 ? () => move(piece.id, 1) : undefined}
              onSetCover={index !== 0 ? () => setCover(piece.id) : undefined}
              onEdit={() => setEditing(piece)}
              onDelete={() => mutations.remove.mutate(piece.id)}
            />
          ))}
        </View>
      )}

      {/* Editing an existing piece stays an inline sheet; adding is the
          full-screen flow above. */}
      <PieceSheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        artistId={artistId}
        userId={userId}
        mode="edit"
        piece={editing}
      />
    </View>
  );
}

function PieceRow({
  piece,
  isCover,
  onMoveUp,
  onMoveDown,
  onSetCover,
  onEdit,
  onDelete,
}: {
  piece: PortfolioPiece;
  isCover: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onSetCover?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-border-subtle bg-surface-overlay p-2.5">
      <View className="h-16 w-16 overflow-hidden rounded-lg bg-surface-raised">
        {piece.image_url ? (
          <Image source={{ uri: piece.image_url }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Icon name="image" size={18} color={colors.text.muted} />
          </View>
        )}
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-sm font-medium text-content-primary" numberOfLines={1}>
          {piece.title || "Untitled piece"}
        </Text>
        {isCover && (
          <Badge variant="brand" size="sm" className="self-start">
            Cover
          </Badge>
        )}
      </View>
      <View className="flex-row gap-1">
        {onMoveUp && <IconAction icon="chevron-left" label="Move earlier" onPress={onMoveUp} />}
        {onMoveDown && <IconAction icon="chevron-right" label="Move later" onPress={onMoveDown} />}
        {onSetCover && <IconAction icon="star" label="Set as cover" onPress={onSetCover} />}
        <IconAction icon="settings" label="Edit" onPress={onEdit} />
        <IconAction icon="x" label="Delete" onPress={onDelete} />
      </View>
    </View>
  );
}

function IconAction({
  icon,
  label,
  onPress,
}: {
  icon: "x" | "chevron-left" | "chevron-right" | "star" | "settings";
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      className="h-8 w-8 items-center justify-center rounded-full bg-surface-raised active:bg-brand"
    >
      <Icon name={icon} size={14} color={colors.text.secondary} />
    </Pressable>
  );
}

function PieceSheet({
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
    <Sheet open={open} onClose={onClose} title={mode === "create" ? "Add portfolio piece" : "Edit piece"}>
      <ScrollView className="max-h-[70vh]" showsVerticalScrollIndicator={false}>
        <View className="gap-4 pb-4">
          <ImageUploadField userId={userId} folder="portfolio" value={imageUrl} onChange={setImageUrl} />
          <FormField label="Title">
            <Input value={title} onChangeText={setTitle} />
          </FormField>
          <FormField label="Placement">
            <Input value={placement} onChangeText={setPlacement} placeholder="Forearm, ribs, calf…" />
          </FormField>
          <FormField label="Description">
            <TextArea value={description} onChangeText={setDescription} numberOfLines={2} />
          </FormField>
          <View className="gap-2">
            <Text className="text-sm font-medium text-content-primary">Styles</Text>
            <View className="flex-row flex-wrap gap-2">
              {(styles ?? []).map((style) => (
                <Chip
                  key={style.id}
                  selected={tags.includes(style.slug)}
                  onPress={() =>
                    setTags((prev) =>
                      prev.includes(style.slug) ? prev.filter((t) => t !== style.slug) : [...prev, style.slug],
                    )
                  }
                >
                  {style.name}
                </Chip>
              ))}
            </View>
          </View>
          <View className="flex-row flex-wrap gap-6">
            <Toggle checked={isHealed} onCheckedChange={setIsHealed} label="Fully healed" />
            <Toggle checked={isPublic} onCheckedChange={setIsPublic} label="Public" />
          </View>
          <View className="flex-row gap-3 pt-2">
            <Button variant="secondary" onPress={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onPress={handleSubmit} loading={saving} className="flex-1">
              {mode === "create" ? "Add" : "Save"}
            </Button>
          </View>
        </View>
      </ScrollView>
    </Sheet>
  );
}
