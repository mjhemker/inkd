/**
 * Instagram media picker (guide §3.D, mobile). Full-screen: a 3-column
 * thumbnail grid of the artist's IG posts with import annotations, select-all,
 * a sticky import bar (≤50), infinite scroll, a synchronous import-progress
 * modal, and a completion sheet.
 *
 * Ephemeral CDN previews (`previewUrl`) are rendered straight from IG and never
 * persisted (guide §7). Broken previews fall back to a caption placeholder so a
 * post is never silently missing.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  FlatList,
  Image,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button, Modal, Sheet, Spinner, useToast } from "@inkd/ui/native";

import { BackButton } from "@/components/BackButton";
import { useTheme } from "@/providers/theme";
import {
  INSTAGRAM_IMPORT_CAP,
  useInstagramImport,
  useInstagramMedia,
  type InstagramImportRun,
  type InstagramMediaItem,
} from "@/lib/instagram";
import { stashImportResult } from "@/lib/instagramConnect";

/** How long to wait before the progress modal reassures the artist that a big
 *  run is still working (guide §3.D: never blind-resubmit). */
const SLOW_IMPORT_MS = 90_000;

export interface InstagramPickerProps {
  artistId: string;
  /** Where the completion CTA sends the artist back to. */
  origin: "settings" | "onboarding";
}

function isSelectable(item: InstagramMediaItem): boolean {
  return item.importable && !item.alreadyImported;
}

function firstLine(caption: string | null): string {
  if (!caption) return "";
  return caption.split("\n")[0]!.trim();
}

export function InstagramPicker({ artistId, origin }: InstagramPickerProps) {
  const { colors } = useTheme();
  const { toast } = useToast();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInstagramMedia(artistId);

  const importRun = useInstagramImport(artistId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [whyItem, setWhyItem] = useState<InstagramMediaItem | null>(null);
  const [completed, setCompleted] = useState<InstagramImportRun | null>(null);
  const [importing, setImporting] = useState(false);
  const [slow, setSlow] = useState(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.items),
    [data],
  );
  const loadedSelectable = useMemo(() => items.filter(isSelectable), [items]);
  const allSelected =
    loadedSelectable.length > 0 &&
    loadedSelectable.every((it) => selected.has(it.id));

  // 3-column grid: full-bleed with 2px gutters.
  const GAP = 2;
  const tile = Math.floor((width - GAP * 2) / 3);

  const toggle = useCallback(
    (item: InstagramMediaItem) => {
      if (!item.importable) {
        setWhyItem(item);
        return;
      }
      if (item.alreadyImported) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          if (next.size >= INSTAGRAM_IMPORT_CAP) {
            toast({
              title: `Import up to ${INSTAGRAM_IMPORT_CAP} at a time`,
              description: "You can run it again for more.",
              variant: "info",
            });
            return prev;
          }
          next.add(item.id);
        }
        return next;
      });
    },
    [toast],
  );

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (loadedSelectable.every((it) => prev.has(it.id)) && prev.size > 0) {
        return new Set();
      }
      const next = new Set(prev);
      for (const it of loadedSelectable) {
        if (next.size >= INSTAGRAM_IMPORT_CAP) break;
        next.add(it.id);
      }
      if (loadedSelectable.length > next.size) {
        toast({
          title: `Selected the first ${next.size}`,
          description: `Import up to ${INSTAGRAM_IMPORT_CAP} at a time.`,
          variant: "info",
        });
      }
      return next;
    });
  }, [loadedSelectable, toast]);

  const clearSlowTimer = useCallback(() => {
    if (slowTimer.current) {
      clearTimeout(slowTimer.current);
      slowTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearSlowTimer(), [clearSlowTimer]);

  async function runImport() {
    const mediaIds = Array.from(selected);
    if (mediaIds.length === 0) return;
    setImporting(true);
    setSlow(false);
    slowTimer.current = setTimeout(() => setSlow(true), SLOW_IMPORT_MS);
    try {
      const run = await importRun.mutateAsync({ mediaIds });
      await stashImportResult(run.piecesCreated);
      setCompleted(run);
      setSelected(new Set());
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    } finally {
      clearSlowTimer();
      setImporting(false);
      setSlow(false);
    }
  }

  function finishToPortfolio() {
    setCompleted(null);
    if (origin === "onboarding") {
      // Onboarding reads the stashed result on focus and shows "N pieces added".
      router.back();
    } else {
      router.replace("/(tabs)/profile");
    }
  }

  // ---- Error / empty states -------------------------------------------------

  const igError = isError
    ? (error as { kind?: string; message?: string } | null)
    : null;

  if (igError && (igError.kind === "tokenExpired" || igError.kind === "notConnected")) {
    return (
      <PickerFrame>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Feather name="instagram" size={32} color={colors.text.muted} />
          <Text className="text-center font-display text-xl text-content-primary">
            {igError.kind === "tokenExpired"
              ? "Reconnect to Instagram"
              : "No Instagram account connected"}
          </Text>
          <Text className="text-center text-sm text-content-secondary">
            {igError.kind === "tokenExpired"
              ? "Your Instagram connection expired. Reconnect from Settings to import posts."
              : "Connect your Instagram account from Settings to import your posts."}
          </Text>
          <Button variant="outline" onPress={() => router.back()}>
            Back to settings
          </Button>
        </View>
      </PickerFrame>
    );
  }

  if (isError) {
    return (
      <PickerFrame>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Feather name="alert-circle" size={32} color={colors.text.muted} />
          <Text className="text-center text-sm text-content-secondary">
            {igError?.message ?? "Couldn't load your Instagram posts."}
          </Text>
          <Button variant="outline" onPress={() => void refetch()}>
            Try again
          </Button>
        </View>
      </PickerFrame>
    );
  }

  if (isLoading) {
    return (
      <PickerFrame>
        <View className="flex-1 items-center justify-center">
          <Spinner size="large" />
        </View>
      </PickerFrame>
    );
  }

  if (items.length === 0) {
    return (
      <PickerFrame>
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Feather name="image" size={30} color={colors.text.muted} />
          <Text className="text-center text-sm text-content-secondary">
            We didn&apos;t find any posts on your Instagram account yet.
          </Text>
        </View>
      </PickerFrame>
    );
  }

  const selectedCount = selected.size;

  return (
    <PickerFrame
      header={
        <Pressable
          onPress={toggleSelectAll}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={allSelected ? "Deselect all loaded" : "Select all loaded"}
        >
          <Text className="font-sans-medium text-sm text-content-accent">
            {allSelected ? "Clear" : "Select all"}
          </Text>
        </Pressable>
      }
    >
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        numColumns={3}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, paddingBottom: 120 }}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="items-center py-6">
              <Spinner size="small" />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <MediaTile
            item={item}
            size={tile}
            selected={selected.has(item.id)}
            broken={broken.has(item.id)}
            onPress={() => toggle(item)}
            onBroken={() =>
              setBroken((prev) => {
                const next = new Set(prev);
                next.add(item.id);
                return next;
              })
            }
          />
        )}
      />

      {/* Sticky import bar */}
      <View
        className="absolute inset-x-0 bottom-0 border-t border-border-subtle bg-surface-raised px-4 pb-8 pt-3"
      >
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="font-sans-semibold text-sm text-content-primary">
              {selectedCount === 0
                ? "Select posts to import"
                : `${selectedCount} selected`}
            </Text>
            <Text className="text-xs text-content-muted">
              Import up to {INSTAGRAM_IMPORT_CAP} at a time — run it again for more.
            </Text>
          </View>
          <Button
            disabled={selectedCount === 0}
            loading={importing}
            onPress={() => void runImport()}
          >
            {selectedCount > 0 ? `Import ${selectedCount}` : "Import"}
          </Button>
        </View>
      </View>

      {/* Import progress (keeps the request alive; never blind-resubmits) */}
      <Modal
        open={importing}
        onClose={() => {}}
        title="Importing your posts"
      >
        <View className="items-center gap-4 py-2">
          <Spinner size="large" />
          <Text className="text-center text-sm text-content-secondary">
            {slow
              ? "Still working — this can take a moment. You can check your portfolio shortly."
              : `Importing ${selectedCount || ""} ${selectedCount === 1 ? "post" : "posts"}…`}
          </Text>
          <Text className="text-center text-xs text-content-muted">
            Keep this screen open — we&apos;re downloading each post into your portfolio.
          </Text>
        </View>
      </Modal>

      {/* Completion */}
      <CompletionSheet
        run={completed}
        origin={origin}
        onClose={() => setCompleted(null)}
        onPrimary={finishToPortfolio}
        onRetry={() => {
          setCompleted(null);
        }}
      />

      {/* "Can't import" why sheet */}
      <Sheet open={whyItem != null} onClose={() => setWhyItem(null)} title="Can’t import this post">
        <View className="gap-3 pb-2">
          <Text className="text-sm text-content-secondary">
            Instagram doesn&apos;t provide a downloadable image for this post — usually because
            it&apos;s flagged for copyrighted audio or content. Everything else on your account
            can still be imported.
          </Text>
          <Button variant="outline" onPress={() => setWhyItem(null)} className="self-start">
            Got it
          </Button>
        </View>
      </Sheet>
    </PickerFrame>
  );
}

/** Screen chrome: BackButton top-left, optional right-side header action. */
function PickerFrame({
  children,
  header,
}: {
  children: ReactNode;
  header?: ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top"]}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <View className="flex-row items-center gap-3">
          <BackButton fallback="/(tabs)/studio/settings" />
          <Text className="font-display text-lg text-content-primary">Import from Instagram</Text>
        </View>
        {header}
      </View>
      <View className="flex-1">{children}</View>
    </SafeAreaView>
  );
}

function MediaTile({
  item,
  size,
  selected,
  broken,
  onPress,
  onBroken,
}: {
  item: InstagramMediaItem;
  size: number;
  selected: boolean;
  broken: boolean;
  onPress: () => void;
  onBroken: () => void;
}) {
  const { colors } = useTheme();
  const selectable = isSelectable(item);
  const dim = !selectable;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: item.alreadyImported }}
      accessibilityLabel={
        item.alreadyImported
          ? "Already imported"
          : !item.importable
            ? "Can’t import — tap for why"
            : selected
              ? "Selected"
              : "Select post"
      }
      style={{ width: size, height: size }}
      className="relative bg-surface-overlay"
    >
      {item.previewUrl && !broken ? (
        <Image
          source={{ uri: item.previewUrl }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={onBroken}
        />
      ) : (
        <View className="h-full w-full items-center justify-center p-2">
          <Feather name="image" size={18} color={colors.text.muted} />
          {firstLine(item.caption) ? (
            <Text
              numberOfLines={3}
              className="mt-1 text-center text-[10px] leading-tight text-content-muted"
            >
              {firstLine(item.caption)}
            </Text>
          ) : null}
        </View>
      )}

      {/* Dim + selection overlays */}
      {dim && <View className="absolute inset-0 bg-black/45" />}
      {selected && (
        <View className="absolute inset-0 border-2 border-brand bg-brand/15" />
      )}

      {/* Top-right selection / status indicator */}
      <View className="absolute right-1.5 top-1.5">
        {item.alreadyImported ? (
          <View className="h-6 w-6 items-center justify-center rounded-full bg-success-500">
            <Feather name="check" size={14} color="#0A0A0B" />
          </View>
        ) : !item.importable ? (
          <View className="h-6 w-6 items-center justify-center rounded-full bg-surface-base/80">
            <Feather name="slash" size={13} color={colors.text.muted} />
          </View>
        ) : selected ? (
          <View className="h-6 w-6 items-center justify-center rounded-full bg-brand">
            <Feather name="check" size={14} color="#FFFFFF" />
          </View>
        ) : (
          <View className="h-6 w-6 rounded-full border-2 border-white/80 bg-black/20" />
        )}
      </View>

      {/* Bottom-left type badges */}
      <View className="absolute bottom-1.5 left-1.5 flex-row items-center gap-1">
        {item.mediaType === "CAROUSEL_ALBUM" && item.childCount > 0 && (
          <View className="flex-row items-center gap-0.5 rounded-sm bg-black/55 px-1 py-0.5">
            <Feather name="layers" size={11} color="#FFFFFF" />
            <Text className="font-mono text-[10px] text-white">{item.childCount}</Text>
          </View>
        )}
        {item.mediaType === "VIDEO" && (
          <View className="rounded-sm bg-black/55 p-0.5">
            <Feather name="film" size={12} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Bottom "Can't import" chip */}
      {!item.importable && (
        <View className="absolute inset-x-1 bottom-1.5 items-center">
          <View className="rounded-sm bg-black/70 px-1.5 py-0.5">
            <Text className="text-[10px] font-sans-medium text-white">Can’t import</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function CompletionSheet({
  run,
  origin,
  onClose,
  onPrimary,
  onRetry,
}: {
  run: InstagramImportRun | null;
  origin: "settings" | "onboarding";
  onClose: () => void;
  onPrimary: () => void;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  const failed = run?.status === "failed";

  return (
    <Sheet
      open={run != null}
      onClose={onClose}
      title={failed ? "Import failed" : "Import complete"}
    >
      {run && (
        <View className="gap-4 pb-2">
          {failed ? (
            <>
              <View className="flex-row items-center gap-2">
                <Feather name="alert-circle" size={18} color="#F87171" />
                <Text className="flex-1 text-sm text-content-secondary">
                  {run.errorMessage ?? "Something went wrong during the import."}
                </Text>
              </View>
              <View className="flex-row justify-end gap-2">
                <Button variant="ghost" onPress={onClose}>
                  Close
                </Button>
                <Button variant="outline" onPress={onRetry}>
                  Try again
                </Button>
              </View>
            </>
          ) : (
            <>
              <View className="flex-row items-center gap-2">
                <Feather name="check-circle" size={18} color={colors.text.accent} />
                <Text className="flex-1 font-sans-semibold text-base text-content-primary">
                  {run.postsCreated}{" "}
                  {run.postsCreated === 1 ? "post imported" : "posts imported"}
                </Text>
              </View>
              <View className="gap-1">
                {run.alreadyImported > 0 && (
                  <Text className="text-sm text-content-secondary">
                    {run.alreadyImported} were already in your portfolio.
                  </Text>
                )}
                {run.mediaSkipped > 0 && (
                  <Text className="text-sm text-content-secondary">
                    {run.mediaSkipped} couldn&apos;t be imported (no downloadable image).
                  </Text>
                )}
              </View>
              <Button onPress={onPrimary}>
                {origin === "onboarding" ? "Back to setup" : "View portfolio"}
              </Button>
            </>
          )}
        </View>
      )}
    </Sheet>
  );
}
