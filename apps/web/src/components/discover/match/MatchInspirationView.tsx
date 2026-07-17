"use client";

/**
 * "Match my inspiration" (web) — the end-to-end experience over the Wave-1
 * visual-similarity backend. Flow:
 *   upload/snap an inspiration image
 *     → upload to a PRIVATE, transient path + sign it
 *     → /api/match-inspiration proxies the bearer-gated tag-image (inline)
 *     → show "what INKD saw" (detected styles/color as chips; refinable)
 *     → rank + group matching artist works into a curated gallery
 *     → filter results by the shared discover filters (location/price/books)
 * The inspiration image is deleted right after tagging — never stored.
 */
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon, Spinner, useToast } from "@inkd/ui/web";
import { useInkdClient, useCurrentProfile, useStyles } from "@inkd/core/hooks";
import {
  uploadInspirationImage,
  deleteInspirationImage,
  matchInspirationFromUrl,
  rankMatchesWithOutcome,
  discoverFilterToParams,
  InspirationTagError,
  EMPTY_FILTER_STATE,
  type DiscoverFilterState,
  type InspirationSummary,
  type MatchArtistGroup,
  type MatchOutcome,
} from "@inkd/core/api";

import { FilterBar } from "../FilterBar";
import { DetectedTagsPanel } from "./DetectedTagsPanel";
import { MatchResultsGallery } from "./MatchResultsGallery";

const TAG_ENDPOINT = "/api/match-inspiration";
const RESULT_LIMIT = 40;

type Phase = "idle" | "working" | "results" | "error";

interface Loaded {
  summary: InspirationSummary;
  embedding: number[];
  groups: MatchArtistGroup[];
  outcome: MatchOutcome;
}

export function MatchInspirationView() {
  const client = useInkdClient();
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const { data: styles = [] } = useStyles();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [filter, setFilter] = useState<DiscoverFilterState>(EMPTY_FILTER_STATE);
  const [refineStyles, setRefineStyles] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [notConfigured, setNotConfigured] = useState(false);
  const [reSearching, setReSearching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const signedIn = !!profile?.id;

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setLoaded(null);
    setFilter(EMPTY_FILTER_STATE);
    setRefineStyles([]);
    setErrorMsg("");
    setNotConfigured(false);
    setPhase("idle");
  }

  async function onFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("That doesn't look like an image. Try a photo of a tattoo.");
      setPhase("error");
      return;
    }
    if (!profile?.id) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMsg("");
    setNotConfigured(false);
    setRefineStyles([]);
    setFilter(EMPTY_FILTER_STATE);
    setPhase("working");

    let uploadedPath: string | null = null;
    try {
      const up = await uploadInspirationImage(client, profile.id, {
        data: file,
        name: file.name || "inspiration.jpg",
        contentType: file.type,
      });
      uploadedPath = up.path;
      const result = await matchInspirationFromUrl(client, up.signedUrl, {
        endpoint: TAG_ENDPOINT,
        limit: RESULT_LIMIT,
      });
      setLoaded({
        summary: result.summary,
        embedding: result.embedding,
        groups: result.groups,
        outcome: result.outcome,
      });
      setPhase("results");
    } catch (e) {
      if (e instanceof InspirationTagError && e.code === "not_configured") {
        setNotConfigured(true);
        setPhase("error");
      } else {
        setErrorMsg(
          e instanceof Error ? e.message : "Something went wrong reading that image.",
        );
        setPhase("error");
      }
    } finally {
      // Transient: the inspiration image is never kept once it's been read.
      if (uploadedPath) void deleteInspirationImage(client, uploadedPath);
    }
  }

  // Re-run the neighbor search for the SAME image (no re-tag) when the client
  // refines styles or changes discover filters.
  async function reSearch(nextFilter: DiscoverFilterState, nextRefine: string[]) {
    if (!loaded) return;
    setReSearching(true);
    try {
      const { groups, outcome } = await rankMatchesWithOutcome(
        client,
        loaded.embedding,
        loaded.summary,
        {
          limit: RESULT_LIMIT,
          styleSlugs: nextRefine.length ? nextRefine : undefined,
          discoverFilters: discoverFilterToParams(nextFilter),
        },
      );
      setLoaded({ ...loaded, groups, outcome });
    } catch {
      // keep prior results on a transient re-search failure
    } finally {
      setReSearching(false);
    }
  }

  function onToggleStyle(slug: string) {
    const next =
      slug === "__reset__"
        ? []
        : refineStyles.includes(slug)
          ? refineStyles.filter((s) => s !== slug)
          : [...refineStyles, slug];
    setRefineStyles(next);
    void reSearch(filter, next);
  }

  function onFilterChange(next: DiscoverFilterState) {
    setFilter(next);
    void reSearch(next, refineStyles);
  }

  const hasResults = loaded && loaded.outcome !== "no_style" && loaded.groups.length > 0;

  const header = useMemo(
    () => (
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Link
            href="/discover"
            className="font-mono text-[10px] uppercase tracking-widest text-content-muted hover:text-content-primary"
          >
            Discover
          </Link>
          <span className="text-content-muted">/</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-content-ember">
            Match my inspiration
          </span>
        </div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-content-primary">
          Search by image
        </h1>
        <p className="max-w-xl text-sm text-content-secondary">
          Upload a tattoo you love and INKD finds artists whose work matches that
          aesthetic — by style, subject, color and composition.
        </p>
      </header>
    ),
    [],
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      {header}

      {!signedIn && !profileLoading ? (
        <SignInGate />
      ) : (
        <>
          {/* Upload / preview */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
            <UploadPanel
              previewUrl={previewUrl}
              phase={phase}
              onPick={() => fileRef.current?.click()}
              onReset={reset}
            />
            <PrivacyNote />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />

          {phase === "working" && <WorkingState />}

          {phase === "error" && (
            <ErrorState
              notConfigured={notConfigured}
              message={errorMsg}
              onRetry={() => fileRef.current?.click()}
            />
          )}

          {phase === "results" && loaded && (
            <div className="flex flex-col gap-5">
              <DetectedTagsPanel
                summary={loaded.summary}
                activeStyleSlugs={refineStyles}
                onToggleStyle={onToggleStyle}
              />

              {hasResults && (
                <details className="rounded-sm border border-border-subtle bg-surface-raised">
                  <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-content-secondary">
                    <Icon name="compass" size={13} /> Filter matches by location, price &amp; books
                    {reSearching && <Spinner size={12} />}
                  </summary>
                  <div className="px-4 pb-4">
                    <FilterBar
                      filter={filter}
                      styles={styles}
                      resultCount={loaded.groups.length}
                      onChange={onFilterChange}
                      onReset={() => onFilterChange(EMPTY_FILTER_STATE)}
                    />
                  </div>
                </details>
              )}

              <MatchResultsGallery
                outcome={loaded.outcome}
                groups={loaded.groups}
                summary={loaded.summary}
                onTryAnother={() => fileRef.current?.click()}
              />

              <SaveStub
                onSave={() =>
                  toast({
                    title: "Coming soon",
                    description: "Saved inspiration boards land in a later update.",
                  })
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UploadPanel({
  previewUrl,
  phase,
  onPick,
  onReset,
}: {
  previewUrl: string | null;
  phase: Phase;
  onPick: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-sm border border-dashed border-border-default bg-surface-raised p-4">
      {previewUrl ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Your inspiration"
            className="h-20 w-20 shrink-0 rounded-sm object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold text-content-primary">
              Your inspiration
            </p>
            <p className="text-xs text-content-secondary">
              {phase === "working" ? "Reading the aesthetic…" : "Analyzed — not stored."}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={onPick}
                className="rounded-lg border border-border-strong px-3 py-1.5 text-xs font-semibold text-content-primary hover:bg-surface-overlay"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={onReset}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-content-muted hover:text-content-primary"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          className="flex flex-col items-center justify-center gap-2 rounded-sm py-8 text-center transition-colors hover:bg-surface-overlay"
        >
          <span className="text-content-ember">
            <Icon name="image" size={28} />
          </span>
          <span className="font-display text-base font-bold text-content-primary">
            Upload or take a photo
          </span>
          <span className="max-w-xs text-xs text-content-secondary">
            A screenshot, a saved reference, or a snap of a tattoo you love.
          </span>
        </button>
      )}
    </div>
  );
}

function PrivacyNote() {
  return (
    <div className="flex items-start gap-2 rounded-sm border border-border-subtle bg-surface-overlay p-3 sm:max-w-[15rem]">
      <span className="mt-0.5 text-content-muted">
        <Icon name="sparkles" size={14} />
      </span>
      <p className="text-xs leading-relaxed text-content-secondary">
        Your image is read on the fly to detect its style and{" "}
        <span className="text-content-primary">never stored</span> — it&rsquo;s deleted
        the moment we&rsquo;ve read it.
      </p>
    </div>
  );
}

function WorkingState() {
  return (
    <div className="flex items-center justify-center gap-3 rounded-sm border border-border-subtle bg-surface-raised py-16">
      <Spinner />
      <span className="text-sm text-content-secondary">
        Reading the style and finding artists who match…
      </span>
    </div>
  );
}

function ErrorState({
  notConfigured,
  message,
  onRetry,
}: {
  notConfigured: boolean;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-border-default bg-surface-raised px-6 py-12 text-center">
      <span className="text-content-muted">
        <Icon name="alert-triangle" size={26} />
      </span>
      <h3 className="font-display text-lg font-bold text-content-primary">
        {notConfigured ? "Image search isn't switched on yet" : "Couldn't read that image"}
      </h3>
      <p className="max-w-md text-sm text-content-secondary">
        {notConfigured
          ? "Image matching is being enabled. Meanwhile you can browse artists by style."
          : message || "Try a different photo of a tattoo."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {notConfigured ? (
          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-on hover:opacity-90"
          >
            <Icon name="compass" size={15} /> Browse by style
          </Link>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-4 py-2 text-sm font-semibold text-content-primary hover:bg-surface-overlay"
          >
            <Icon name="image" size={15} /> Try another image
          </button>
        )}
      </div>
    </div>
  );
}

function SignInGate() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-border-default bg-surface-raised px-6 py-12 text-center">
      <span className="text-content-ember">
        <Icon name="image" size={28} />
      </span>
      <h3 className="font-display text-lg font-bold text-content-primary">
        Sign in to search by image
      </h3>
      <p className="max-w-md text-sm text-content-secondary">
        Matching your inspiration needs an account. It&rsquo;s free — your image is
        analyzed on the fly and never stored.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link
          href="/auth"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-on hover:opacity-90"
        >
          Sign in
        </Link>
        <Link
          href="/discover"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-4 py-2 text-sm font-semibold text-content-primary hover:bg-surface-overlay"
        >
          Browse by style
        </Link>
      </div>
    </div>
  );
}

function SaveStub({ onSave }: { onSave: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm border border-border-subtle bg-surface-overlay px-4 py-3">
      <p className="text-xs text-content-secondary">
        Want to come back to these artists? Save this inspiration to a board.
      </p>
      <button
        type="button"
        onClick={onSave}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-strong px-3 py-1.5 text-xs font-semibold text-content-primary hover:bg-surface-raised"
      >
        <Icon name="plus" size={13} /> Save
        <span className="font-mono text-[9px] uppercase tracking-widest text-content-muted">
          Soon
        </span>
      </button>
    </div>
  );
}
