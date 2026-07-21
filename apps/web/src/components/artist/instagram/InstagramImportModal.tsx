"use client";

/**
 * Instagram import picker — the core new surface (UI guide §3.D). A full-screen
 * overlay (not the centered Modal primitive: a responsive placard grid needs
 * the width) shared by the settings section and the onboarding card.
 *
 * Hard rules honored here:
 *   - Thumbnails render straight from the EPHEMERAL `preview_url` (Instagram
 *     CDN); we never persist/cache them. Broken-image → placeholder + caption.
 *   - Selection is EXPLICIT: nothing is pre-selected; already-imported and
 *     unimportable tiles are visibly labeled + disabled, never hidden.
 *   - Import is synchronous: we keep the request alive and, after a soft
 *     timeout, say "Still working — check your portfolio in a minute" instead
 *     of resubmitting.
 */
import { useEffect, useMemo, useState } from "react";
import { Button, Icon, Sheet, Spinner, useToast } from "@inkd/ui/web";
import {
  useInstagramMedia,
  useInstagramImport,
  InstagramError,
  isImportSelectable,
  toggleSelection,
  selectAllOnPage,
  selectionCapMessage,
  remainingSelectable,
  buildCompletionMessage,
  IG_IMPORT_MAX,
  type InstagramMediaItem,
  type InstagramImportRunResult,
} from "@inkd/core";
import { CarouselGlyph, VideoGlyph } from "./glyphs";

export interface InstagramImportModalProps {
  artistId: string;
  open: boolean;
  onClose: () => void;
  /** Fired once with the finished run when an import completes successfully. */
  onImported?: (run: InstagramImportRunResult) => void;
  /** When set, the completion sheet shows a "View portfolio" CTA to this href. */
  portfolioHref?: string;
}

export function InstagramImportModal({
  artistId,
  open,
  onClose,
  onImported,
  portfolioHref = "/profile",
}: InstagramImportModalProps) {
  const { toast } = useToast();
  const media = useInstagramMedia(artistId, { enabled: open });
  const importer = useInstagramImport(artistId);

  const [selected, setSelected] = useState<string[]>([]);
  const [explainerOpen, setExplainerOpen] = useState(false);

  const items = useMemo<InstagramMediaItem[]>(
    () => media.data?.pages.flatMap((p) => p.items) ?? [],
    [media.data],
  );

  // Reset selection + import state each time the picker opens.
  useEffect(() => {
    if (open) {
      setSelected([]);
      importer.reset();
    }
    // Deliberately keyed only on `open` (reset the picker each time it opens).
  }, [open]);

  // Fire onImported once, on a successful completed run.
  useEffect(() => {
    if (importer.run && importer.run.status === "completed") onImported?.(importer.run);
    // Deliberately keyed only on the run object.
  }, [importer.run]);

  if (!open) return null;

  const eligibleOnPage = items.filter(isImportSelectable);
  const allEligibleSelected =
    eligibleOnPage.length > 0 && eligibleOnPage.every((i) => selected.includes(i.id));

  function toggle(item: InstagramMediaItem) {
    setSelected((cur) => {
      const next = toggleSelection(cur, item);
      if (next.length === cur.length && !cur.includes(item.id) && isImportSelectable(item)) {
        toast({
          title: `That's the max — ${IG_IMPORT_MAX} at a time`,
          description: "Import these, then run it again for more.",
        });
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((cur) => {
      if (allEligibleSelected) {
        const pageIds = new Set(eligibleOnPage.map((i) => i.id));
        return cur.filter((id) => !pageIds.has(id));
      }
      return selectAllOnPage(cur, items);
    });
  }

  async function runImport() {
    try {
      await importer.importSelected(selected);
    } catch (err) {
      toast({
        title: "Couldn't import",
        description: describeError(err),
        variant: "danger",
      });
    }
  }

  const run = importer.run;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-surface-base"
      role="dialog"
      aria-modal="true"
      aria-label="Import from Instagram"
    >
      {/* Header placard */}
      <header className="flex items-center justify-between border-b border-border-subtle bg-surface-overlay px-5 py-3">
        <div className="flex flex-col">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
            Instagram import
          </span>
          <h2 className="font-display text-lg font-bold tracking-tight text-content-primary">
            Choose posts to import
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-sm text-content-secondary outline-none transition-colors hover:bg-surface-raised hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand"
          aria-label="Close"
        >
          <Icon name="x" size={18} />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {media.isLoading ? (
          <div className="grid min-h-[40vh] place-items-center">
            <Spinner size={24} />
          </div>
        ) : media.isError ? (
          <MediaError error={media.error} onRetry={() => void media.refetch()} onClose={onClose} />
        ) : items.length === 0 ? (
          <EmptyMedia />
        ) : (
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
            {/* Select-all-on-page */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={eligibleOnPage.length === 0}
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-content-secondary underline-offset-4 outline-none hover:text-content-primary hover:underline focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
              >
                {allEligibleSelected ? "Clear page" : "Select all on page"}
              </button>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-content-muted">
                {items.length} shown
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((item) => (
                <MediaTile
                  key={item.id}
                  item={item}
                  selected={selected.includes(item.id)}
                  onToggle={() => toggle(item)}
                  onExplainUnimportable={() => setExplainerOpen(true)}
                />
              ))}
            </div>

            {media.hasNextPage && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void media.fetchNextPage()}
                  loading={media.isFetchingNextPage}
                >
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer batch bar */}
      {!media.isLoading && !media.isError && items.length > 0 && (
        <footer className="flex items-center justify-between gap-4 border-t border-border-subtle bg-surface-overlay px-5 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-content-primary">
              {selectionCapMessage(selected.length)}
            </span>
            {selected.length > 0 && remainingSelectable(selected.length) === 0 && (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-content-muted">
                Import up to {IG_IMPORT_MAX} at a time — run it again for more
              </span>
            )}
          </div>
          <Button
            onClick={() => void runImport()}
            disabled={selected.length === 0 || importer.isImporting}
            loading={importer.isImporting}
          >
            Import {selected.length > 0 ? selected.length : ""}{" "}
            {selected.length === 1 ? "post" : "posts"}
          </Button>
        </footer>
      )}

      {/* Importing overlay (non-blocking of the request; keeps it alive) */}
      {importer.isImporting && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-surface-base/80 backdrop-blur-sm">
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <Spinner size={28} />
            <p className="text-sm font-medium text-content-primary">
              Importing {selected.length} {selected.length === 1 ? "post" : "posts"}…
            </p>
            <p className="text-xs text-content-muted">
              {importer.softTimedOut
                ? "Still working — check your portfolio in a minute. No need to resubmit."
                : "This can take a moment for larger batches. Keep this open."}
            </p>
          </div>
        </div>
      )}

      {/* Completion / failure sheet */}
      <Sheet
        open={Boolean(run)}
        onClose={() => {
          importer.reset();
          if (run?.status === "completed") onClose();
        }}
        title={run?.status === "failed" ? "Import didn't finish" : "Import complete"}
      >
        {run && (
          <div className="flex flex-col gap-4 pb-2">
            {run.status === "completed" ? (
              <>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-sm bg-surface-ember text-brand-on-ember">
                    <Icon name="check" size={18} />
                  </span>
                  <p className="text-sm text-content-secondary">{buildCompletionMessage(run)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {portfolioHref && (
                    <a href={portfolioHref}>
                      <Button size="sm">
                        View portfolio
                        <Icon name="arrow-right" size={15} />
                      </Button>
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      importer.reset();
                      setSelected([]);
                    }}
                  >
                    Import more
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-sm bg-surface-overlay text-danger-500">
                    <Icon name="alert-triangle" size={18} />
                  </span>
                  <p className="text-sm text-content-secondary">
                    {run.error_message ?? "Something went wrong. Your selection is safe to retry."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void runImport()} loading={importer.isImporting}>
                    Retry
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => importer.reset()}>
                    Back to picker
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Sheet>

      {/* "Can't be imported" explainer */}
      <Sheet
        open={explainerOpen}
        onClose={() => setExplainerOpen(false)}
        title="Why can't this post be imported?"
      >
        <p className="pb-4 text-sm leading-relaxed text-content-secondary">
          Instagram doesn&apos;t provide the image for this post — usually because it uses
          copyright-flagged audio or content. Everything else can still be imported.
        </p>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Media tile
// ---------------------------------------------------------------------------

function MediaTile({
  item,
  selected,
  onToggle,
  onExplainUnimportable,
}: {
  item: InstagramMediaItem;
  selected: boolean;
  onToggle: () => void;
  onExplainUnimportable: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const selectable = isImportSelectable(item);
  const isCarousel = item.media_type === "CAROUSEL_ALBUM" || item.child_count > 0;
  const isVideo = item.media_type === "VIDEO";

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={selectable ? onToggle : item.importable ? undefined : onExplainUnimportable}
        aria-pressed={selected}
        disabled={item.already_imported}
        className={[
          "group relative aspect-square overflow-hidden rounded-sm border bg-surface-raised text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand",
          selected
            ? "border-border-accent ring-2 ring-brand"
            : "border-border-subtle hover:border-border-strong",
          item.already_imported || !item.importable ? "cursor-default" : "cursor-pointer",
        ].join(" ")}
      >
        {item.preview_url && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.preview_url}
            alt={item.caption ?? "Instagram post"}
            className={[
              "h-full w-full object-cover transition-opacity",
              selectable ? "" : "opacity-45",
            ].join(" ")}
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
            <Icon name="image" size={18} className="text-content-muted" />
            <span className="line-clamp-3 font-mono text-[9px] uppercase tracking-[0.12em] text-content-muted">
              {item.caption ? item.caption.slice(0, 60) : "No preview"}
            </span>
          </div>
        )}

        {/* Selection check */}
        {selected && (
          <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-surface-ember text-brand-on-ember">
            <Icon name="check" size={13} />
          </span>
        )}

        {/* Type badges (carousel / video) */}
        <div className="absolute left-1.5 top-1.5 flex gap-1">
          {isCarousel && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-surface-base/85 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-content-secondary">
              <CarouselGlyph size={11} />
              {item.child_count > 0 ? `${item.child_count} photos` : "Album"}
            </span>
          )}
          {isVideo && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-surface-base/85 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-content-secondary">
              <VideoGlyph size={10} />
              Video
            </span>
          )}
        </div>

        {/* State overlays */}
        {item.already_imported && (
          <span className="absolute inset-x-1.5 bottom-1.5 inline-flex items-center justify-center gap-1 rounded-sm bg-surface-base/85 px-1.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-content-secondary">
            <Icon name="check" size={11} /> Already imported
          </span>
        )}
        {!item.already_imported && !item.importable && (
          <span className="absolute inset-x-1.5 bottom-1.5 inline-flex items-center justify-center gap-1 rounded-sm bg-surface-base/85 px-1.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-warning-500">
            <Icon name="alert-triangle" size={11} /> Can&apos;t be imported
          </span>
        )}
      </button>

      {isVideo && selectable && (
        <span className="px-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-content-muted">
          Cover still imported
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

function MediaError({
  error,
  onRetry,
  onClose,
}: {
  error: unknown;
  onRetry: () => void;
  onClose: () => void;
}) {
  const tokenExpired = error instanceof InstagramError && error.kind === "tokenExpired";
  return (
    <div className="mx-auto grid min-h-[40vh] max-w-sm place-items-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-sm bg-surface-overlay text-content-secondary">
          <Icon name="alert-triangle" size={20} />
        </span>
        <p className="text-sm text-content-secondary">
          {tokenExpired
            ? "Your Instagram connection expired. Reconnect from settings, then try again."
            : describeError(error)}
        </p>
        {tokenExpired ? (
          <Button size="sm" variant="outline" onClick={onClose}>
            Back to settings
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

function EmptyMedia() {
  return (
    <div className="mx-auto grid min-h-[40vh] max-w-sm place-items-center">
      <div className="flex flex-col items-center gap-2 text-center">
        <Icon name="image" size={22} className="text-content-muted" />
        <p className="text-sm text-content-secondary">No Instagram posts found to import.</p>
      </div>
    </div>
  );
}

function describeError(err: unknown): string {
  if (err instanceof InstagramError) return err.message;
  if (err instanceof RangeError) return err.message;
  if (err instanceof Error) return err.message;
  return "Please try again.";
}
