"use client";

import { useState } from "react";
import {
  Badge,
  Button,
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
  useFlashItemMutations,
  useFlashItems,
  useFlashSheetMutations,
  useFlashSheets,
  type FlashItem,
  type FlashSheet,
} from "@inkd/core";
import { flashPriceLabel } from "@/lib/format";
import { ImageUploadField } from "./ImageUploadField";

export function FlashPanel({ artistId, userId }: { artistId: string; userId: string }) {
  const { data: sheets, isLoading } = useFlashSheets(artistId);
  const [createOpen, setCreateOpen] = useState(false);
  const [managingId, setManagingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-content-muted">
          Pre-drawn designs clients can book directly, priced and sized up front.
        </p>
        {/* This tab's single action → the one hero on the screen. */}
        <Button hero leadingIcon={<Icon name="plus" size={16} />} onClick={() => setCreateOpen(true)}>
          New sheet
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-surface-overlay" />
          ))}
        </div>
      ) : !sheets || sheets.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-surface-raised/40">
          <EmptyState
            icon={<Icon name="sparkles" size={26} />}
            title="No flash sheets yet"
            description="Bundle ready-to-book designs with a price and size so clients can claim them instantly."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Create a flash sheet
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sheets.map((sheet) => (
            <SheetCard key={sheet.id} sheet={sheet} onManage={() => setManagingId(sheet.id)} />
          ))}
        </div>
      )}

      <CreateSheetModal
        open={createOpen}
        onClose={(newId) => {
          setCreateOpen(false);
          if (newId) setManagingId(newId);
        }}
        artistId={artistId}
        userId={userId}
      />
      {managingId && (
        <ManageSheetModal
          sheetId={managingId}
          artistId={artistId}
          userId={userId}
          onClose={() => setManagingId(null)}
        />
      )}
    </div>
  );
}

function SheetCard({ sheet, onManage }: { sheet: FlashSheet; onManage: () => void }) {
  const { data: items } = useFlashItems(sheet.id);
  return (
    <button
      type="button"
      onClick={onManage}
      className="group block w-full text-left outline-none"
    >
      <div className="relative aspect-[4/3] overflow-hidden border border-border-subtle bg-surface-overlay group-focus-visible:ring-2 group-focus-visible:ring-brand">
        {sheet.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sheet.cover_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-content-muted">
            <Icon name="sparkles" size={22} />
          </div>
        )}
        {!sheet.is_public && (
          <span className="absolute left-2 top-2 rounded-sm bg-black/60 px-2 py-0.5 text-[11px] font-medium text-content-secondary">
            Private
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-col gap-0.5">
        <p className="truncate text-sm font-semibold text-content-primary">
          {sheet.title || "Untitled sheet"}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-content-muted">
          {items ? `${items.length} piece${items.length === 1 ? "" : "s"}` : "…"}
        </p>
      </div>
    </button>
  );
}

function CreateSheetModal({
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
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New flash sheet"
      footer={
        <>
          <Button variant="ghost" onClick={() => onClose()}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={mutations.create.isPending}>
            Create sheet
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ImageUploadField userId={userId} folder="flash" value={coverUrl} onChange={setCoverUrl} aspect="wide" />
        <FormField label="Sheet name" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summer flash drop" />
        </FormField>
        <FormField label="Description">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </FormField>
      </div>
    </Modal>
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
    <Modal open onClose={onClose} title="Manage flash sheet" size="lg">
      <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="text-sm text-content-muted">Loading pieces…</p>
        ) : !items || items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-overlay p-6 text-center text-sm text-content-muted">
            No pieces yet. Add your first design below.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <FlashItemRow
                key={item.id}
                item={item}
                onToggleAvailable={(checked) =>
                  itemMutations.setAvailability.mutate({ id: item.id, isAvailable: checked })
                }
                onEdit={() => setEditingItem(item)}
                onDelete={() => itemMutations.remove.mutate(item.id)}
              />
            ))}
          </div>
        )}

        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Icon name="plus" size={16} />}
          onClick={() => setAddingItem(true)}
          className="self-start"
        >
          Add piece
        </Button>

        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <Button variant="ghost" size="sm" onClick={handleDeleteSheet} className="text-danger-500">
            Delete sheet
          </Button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>

      <FlashItemModal
        open={addingItem}
        onClose={() => setAddingItem(false)}
        artistId={artistId}
        flashSheetId={sheetId}
        userId={userId}
        mode="create"
      />
      <FlashItemModal
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
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-overlay p-2.5">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-raised">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-content-muted">
            <Icon name="image" size={18} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content-primary">
          {item.title || "Untitled piece"}
        </p>
        <p className="text-xs">
          <span className="text-money">{flashPriceLabel(item.price_cents)}</span>
          {item.size_inches ? <span className="text-content-muted">{` · ${item.size_inches}"`}</span> : null}
        </p>
      </div>
      <Badge variant={item.is_available ? "success" : "neutral"} size="sm">
        {item.is_available ? "Available" : "Claimed"}
      </Badge>
      <Toggle checked={item.is_available} onCheckedChange={onToggleAvailable} />
      <button
        type="button"
        aria-label="Edit piece"
        onClick={onEdit}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-content-muted hover:bg-surface-raised hover:text-content-primary"
      >
        <Icon name="settings" size={16} />
      </button>
      <button
        type="button"
        aria-label="Delete piece"
        onClick={onDelete}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-content-muted hover:bg-surface-raised hover:text-danger-500"
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

function FlashItemModal({
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
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Add flash piece" : "Edit piece"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {mode === "create" ? "Add piece" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ImageUploadField userId={userId} folder="flash" value={imageUrl} onChange={setImageUrl} />
        <FormField label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Swallow" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Price ($)">
            <Input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="150"
            />
          </FormField>
          <FormField label="Size (in)">
            <Input
              type="number"
              min={0}
              step="0.5"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="4"
            />
          </FormField>
        </div>
        <FormField label="Suggested placement">
          <Input value={placement} onChange={(e) => setPlacement(e.target.value)} placeholder="Forearm" />
        </FormField>
        <div className="flex flex-wrap gap-6">
          <Toggle checked={repeatable} onCheckedChange={setRepeatable} label="Repeatable design" />
          <Toggle checked={available} onCheckedChange={setAvailable} label="Available" />
        </div>
      </div>
    </Modal>
  );
}
