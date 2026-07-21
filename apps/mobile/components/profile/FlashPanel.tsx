import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  Icon,
  Input,
  Modal,
  Sheet,
  Skeleton,
  TextArea,
  Toggle,
  useToast,
} from "@inkd/ui/native";
import {
  useFlashItemMutations,
  useFlashItems,
  useFlashSheetMutations,
  useFlashSheets,
  type FlashItem,
  type FlashSheet,
} from "@inkd/core";
import { flashPriceLabel } from "@/lib/format";
import { useTheme } from "@/providers/theme";
import { ImageUploadField } from "./ImageUploadField";

export function FlashPanel({ artistId, userId }: { artistId: string; userId: string }) {
  const { colors } = useTheme();
  const { data: sheets, isLoading } = useFlashSheets(artistId);
  const [createOpen, setCreateOpen] = useState(false);
  const [managingId, setManagingId] = useState<string | null>(null);

  return (
    <View className="gap-4">
      <View className="gap-3">
        <Text className="text-sm text-content-muted">
          Pre-drawn designs clients can book directly, priced and sized up front.
        </Text>
        {/* This tab's single action → the one hero on the screen. */}
        <Button hero className="w-full" leadingIcon={<Icon name="plus" size={16} color="#FAFAFA" />} onPress={() => setCreateOpen(true)}>
          New sheet
        </Button>
      </View>

      {isLoading ? (
        <View className="flex-row flex-wrap gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-[48%]" />
          ))}
        </View>
      ) : !sheets || sheets.length === 0 ? (
        <EmptyState
          icon={<Icon name="sparkles" size={28} color={colors.text.muted} />}
          title="No flash sheets yet"
          description="Bundle ready-to-book designs with a price and size."
          action={
            <Button size="sm" onPress={() => setCreateOpen(true)}>
              Create a flash sheet
            </Button>
          }
        />
      ) : (
        <View className="flex-row flex-wrap gap-2.5">
          {sheets.map((sheet) => (
            <SheetCard key={sheet.id} sheet={sheet} onManage={() => setManagingId(sheet.id)} />
          ))}
        </View>
      )}

      <CreateSheetSheet
        open={createOpen}
        onClose={(newId) => {
          setCreateOpen(false);
          if (newId) setManagingId(newId);
        }}
        artistId={artistId}
        userId={userId}
      />
      {managingId && (
        <ManageSheetModal sheetId={managingId} artistId={artistId} userId={userId} onClose={() => setManagingId(null)} />
      )}
    </View>
  );
}

function SheetCard({ sheet, onManage }: { sheet: FlashSheet; onManage: () => void }) {
  const { colors } = useTheme();
  const { data: items } = useFlashItems(sheet.id);
  return (
    <Pressable
      onPress={onManage}
      className="w-[48%] overflow-hidden rounded-xl border border-border-subtle bg-surface-raised active:opacity-80"
    >
      <View className="aspect-[4/3] bg-surface-overlay">
        {sheet.cover_url ? (
          <Image source={{ uri: sheet.cover_url }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Icon name="sparkles" size={20} color={colors.text.muted} />
          </View>
        )}
      </View>
      <View className="gap-0.5 p-2.5">
        <Text className="text-sm font-semibold text-content-primary" numberOfLines={1}>
          {sheet.title || "Untitled sheet"}
        </Text>
        <Text className="text-xs text-content-muted">
          {items ? `${items.length} piece${items.length === 1 ? "" : "s"}` : "…"}
        </Text>
      </View>
    </Pressable>
  );
}

function CreateSheetSheet({
  open,
  onClose,
  artistId,
  userId,
}: {
  open: boolean;
  onClose: (newSheetId?: string) => void;
  artistId: string;
  userId: string;
}) {
  const { toast } = useToast();
  const mutations = useFlashSheetMutations(artistId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  function reset() {
    setTitle("");
    setDescription("");
    setCoverUrl("");
  }

  async function handleCreate() {
    if (!title.trim()) {
      toast({ title: "Give this sheet a name", variant: "danger" });
      return;
    }
    try {
      const sheet = await mutations.create.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        cover_url: coverUrl || null,
        is_public: true,
      });
      toast({ title: "Sheet created — add your designs", variant: "success" });
      reset();
      onClose(sheet.id);
    } catch (err) {
      toast({
        title: "Couldn't create sheet",
        description: err instanceof Error ? err.message : undefined,
        variant: "danger",
      });
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New flash sheet"
    >
      <ScrollView className="max-h-[70vh]" showsVerticalScrollIndicator={false}>
        <View className="gap-4 pb-4">
          <ImageUploadField userId={userId} folder="flash" value={coverUrl} onChange={setCoverUrl} aspect="wide" />
          <FormField label="Sheet name" required>
            <Input value={title} onChangeText={setTitle} placeholder="Summer flash drop" />
          </FormField>
          <FormField label="Description">
            <TextArea value={description} onChangeText={setDescription} numberOfLines={2} />
          </FormField>
          <View className="flex-row gap-3 pt-2">
            <Button variant="secondary" onPress={() => onClose()} className="flex-1">
              Cancel
            </Button>
            <Button onPress={handleCreate} loading={mutations.create.isPending} className="flex-1">
              Create
            </Button>
          </View>
        </View>
      </ScrollView>
    </Sheet>
  );
}

function ManageSheetModal({
  sheetId,
  artistId,
  userId,
  onClose,
}: {
  sheetId: string;
  artistId: string;
  userId: string;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { toast } = useToast();
  const { data: items, isLoading } = useFlashItems(sheetId);
  const sheetMutations = useFlashSheetMutations(artistId);
  const itemMutations = useFlashItemMutations(artistId, sheetId);
  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<FlashItem | null>(null);

  async function handleDeleteSheet() {
    try {
      await sheetMutations.remove.mutateAsync(sheetId);
      toast({ title: "Sheet deleted" });
      onClose();
    } catch {
      toast({ title: "Couldn't delete sheet", variant: "danger" });
    }
  }

  return (
    <Modal open onClose={onClose} title="Manage flash sheet">
      <ScrollView className="max-h-[60vh]" showsVerticalScrollIndicator={false}>
        <View className="gap-3 pb-2">
          {isLoading ? (
            <Text className="text-sm text-content-muted">Loading pieces…</Text>
          ) : !items || items.length === 0 ? (
            <View className="rounded-xl border border-dashed border-border bg-surface-overlay p-6">
              <Text className="text-center text-sm text-content-muted">
                No pieces yet. Add your first design below.
              </Text>
            </View>
          ) : (
            items.map((item) => (
              <FlashItemRow
                key={item.id}
                item={item}
                onToggleAvailable={(checked) =>
                  itemMutations.setAvailability.mutate({ id: item.id, isAvailable: checked })
                }
                onEdit={() => setEditingItem(item)}
                onDelete={() => itemMutations.remove.mutate(item.id)}
              />
            ))
          )}

          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Icon name="plus" size={16} color={colors.text.primary} />}
            onPress={() => setAddingItem(true)}
          >
            Add piece
          </Button>

          <View className="flex-row items-center justify-between border-t border-border-subtle pt-4">
            <Button variant="ghost" size="sm" onPress={handleDeleteSheet}>
              Delete sheet
            </Button>
            <Button size="sm" onPress={onClose}>
              Done
            </Button>
          </View>
        </View>
      </ScrollView>

      <FlashItemSheet open={addingItem} onClose={() => setAddingItem(false)} artistId={artistId} flashSheetId={sheetId} userId={userId} mode="create" />
      <FlashItemSheet
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        artistId={artistId}
        flashSheetId={sheetId}
        userId={userId}
        mode="edit"
        item={editingItem}
      />
    </Modal>
  );
}

function FlashItemRow({
  item,
  onToggleAvailable,
  onEdit,
  onDelete,
}: {
  item: FlashItem;
  onToggleAvailable: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-border-subtle bg-surface-overlay p-2.5">
      <View className="h-14 w-14 overflow-hidden rounded-lg bg-surface-raised">
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Icon name="image" size={16} color={colors.text.muted} />
          </View>
        )}
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-sm font-medium text-content-primary" numberOfLines={1}>
          {item.title || "Untitled piece"}
        </Text>
        <Text className="text-xs">
          <Text className="font-mono-medium text-content-ember">{flashPriceLabel(item.price_cents)}</Text>
          <Text className="text-content-muted">{item.size_inches ? ` · ${item.size_inches}"` : ""}</Text>
        </Text>
      </View>
      <Badge variant={item.is_available ? "success" : "neutral"} size="sm">
        {item.is_available ? "Available" : "Claimed"}
      </Badge>
      <Toggle checked={item.is_available} onCheckedChange={onToggleAvailable} />
      <Pressable accessibilityRole="button" accessibilityLabel="Edit piece" hitSlop={6} onPress={onEdit} className="h-8 w-8 items-center justify-center rounded-lg active:bg-surface-raised">
        <Icon name="settings" size={16} color={colors.text.secondary} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Delete piece" hitSlop={6} onPress={onDelete} className="h-8 w-8 items-center justify-center rounded-lg active:bg-surface-raised">
        <Icon name="x" size={16} color={colors.text.secondary} />
      </Pressable>
    </View>
  );
}

function FlashItemSheet({
  open,
  onClose,
  artistId,
  flashSheetId,
  userId,
  mode,
  item,
}: {
  open: boolean;
  onClose: () => void;
  artistId: string;
  flashSheetId: string;
  userId: string;
  mode: "create" | "edit";
  item?: FlashItem | null;
}) {
  const { toast } = useToast();
  const mutations = useFlashItemMutations(artistId, flashSheetId);

  const [imageUrl, setImageUrl] = useState(item?.image_url ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [price, setPrice] = useState(item?.price_cents != null ? String(item.price_cents / 100) : "");
  const [size, setSize] = useState(item?.size_inches != null ? String(item.size_inches) : "");
  const [placement, setPlacement] = useState(item?.placement_suggestion ?? "");
  const [repeatable, setRepeatable] = useState(item?.is_repeatable ?? false);
  const [available, setAvailable] = useState(item?.is_available ?? true);

  const key = item?.id ?? "new";
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setImageUrl(item?.image_url ?? "");
    setTitle(item?.title ?? "");
    setPrice(item?.price_cents != null ? String(item.price_cents / 100) : "");
    setSize(item?.size_inches != null ? String(item.size_inches) : "");
    setPlacement(item?.placement_suggestion ?? "");
    setRepeatable(item?.is_repeatable ?? false);
    setAvailable(item?.is_available ?? true);
  }

  async function handleSubmit() {
    if (!imageUrl) {
      toast({ title: "Add a photo first", variant: "danger" });
      return;
    }
    const priceCents = price ? Math.round(Number(price) * 100) : null;
    const sizeInches = size ? Number(size) : null;
    try {
      if (mode === "create") {
        await mutations.create.mutateAsync({
          flash_sheet_id: flashSheetId,
          image_url: imageUrl,
          title: title.trim() || null,
          price_cents: priceCents,
          size_inches: sizeInches,
          placement_suggestion: placement.trim() || null,
          is_repeatable: repeatable,
          is_available: available,
        });
        toast({ title: "Piece added", variant: "success" });
      } else if (item) {
        await mutations.update.mutateAsync({
          id: item.id,
          patch: {
            image_url: imageUrl,
            title: title.trim() || null,
            price_cents: priceCents,
            size_inches: sizeInches,
            placement_suggestion: placement.trim() || null,
            is_repeatable: repeatable,
            is_available: available,
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
    <Sheet open={open} onClose={onClose} title={mode === "create" ? "Add flash piece" : "Edit piece"}>
      <ScrollView className="max-h-[70vh]" showsVerticalScrollIndicator={false}>
        <View className="gap-4 pb-4">
          <ImageUploadField userId={userId} folder="flash" value={imageUrl} onChange={setImageUrl} />
          <FormField label="Title">
            <Input value={title} onChangeText={setTitle} placeholder="Swallow" />
          </FormField>
          <View className="flex-row gap-3">
            <FormField label="Price ($)" className="flex-1">
              <Input keyboardType="numeric" value={price} onChangeText={setPrice} placeholder="150" />
            </FormField>
            <FormField label="Size (in)" className="flex-1">
              <Input keyboardType="numeric" value={size} onChangeText={setSize} placeholder="4" />
            </FormField>
          </View>
          <FormField label="Suggested placement">
            <Input value={placement} onChangeText={setPlacement} placeholder="Forearm" />
          </FormField>
          <View className="flex-row flex-wrap gap-6">
            <Toggle checked={repeatable} onCheckedChange={setRepeatable} label="Repeatable" />
            <Toggle checked={available} onCheckedChange={setAvailable} label="Available" />
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
