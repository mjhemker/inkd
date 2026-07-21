"use client";

/**
 * The Daily Drop REVEAL — a once-a-day full-screen takeover (founder §engagement:
 * "the first time a user logs on that day they get a full-screen pop-up: 'Reveal
 * your Daily Drop' with an INKD Drop logo + animation; after that it lives in a
 * highlighted component on Home").
 *
 * Flow: a teaser ("Your Daily Drop" + the animated INKD Drop mark, tap to reveal)
 * → an ink-spread reveal of the artwork placard (artist, style stamps,
 * flash/original, price if flash) → CTAs (view artist / view piece / dismiss).
 * Dismissing writes today's date to localStorage so it never shows again that
 * day; the drop then lives on as the `DailyDropCard` atop the feed.
 *
 * Dependency-free: CSS keyframes only, all disabled under prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, LogoDropMark, cx } from "@inkd/ui/web";
import { useMarkDropClicked, useMarkDropSeen, type DailyDropCard as DailyDropCardData } from "@inkd/core";
import { flashPriceLabel } from "@/lib/format";
import { artworkGradient } from "@/components/feed/artwork";

const REVEAL_KEY = "inkd:daily-drop:revealed";

/** True when the reveal has already been shown+dismissed for `date` (YYYY-MM-DD). */
export function hasRevealedDailyDrop(date: string): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(REVEAL_KEY) === date;
  } catch {
    return false;
  }
}

/** Record that today's reveal has been seen so it never shows again today. */
export function markDailyDropRevealed(date: string): void {
  try {
    window.localStorage.setItem(REVEAL_KEY, date);
  } catch {
    // private mode / storage disabled — the in-memory dismiss still holds for the session
  }
}

function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

type Phase = "teaser" | "revealing" | "revealed";

export interface DailyDropRevealProps {
  card: DailyDropCardData;
  /** Called when the user dismisses (from teaser or after reveal). */
  onDismiss: () => void;
}

export function DailyDropReveal({ card, onDismiss }: DailyDropRevealProps) {
  const reduced = useRef(prefersReducedMotion());
  const [phase, setPhase] = useState<Phase>("teaser");
  const seen = useMarkDropSeen();
  const clicked = useMarkDropClicked();
  const firedSeen = useRef(false);
  // The reveal → revealed animation timer. Tracked so it's cleared if the user
  // dismisses (unmounting the takeover) mid-animation — otherwise it would fire
  // a state update after unmount.
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, []);

  const artist = card.artist;
  const handle = artist?.handle ?? null;
  const artistName = artist?.displayName ?? (handle ? `@${handle}` : "an INKD artist");
  const artistHref = handle ? `/a/${handle}` : null;
  const isFlash = card.subjectType === "flash";
  const image = isFlash ? card.flash?.imageUrl ?? null : card.post?.coverUrl ?? null;
  const styleTags = (isFlash ? card.flash?.styleTags : card.post?.styleTags) ?? [];
  const location = [artist?.city, artist?.state].filter(Boolean).join(", ");

  // Mark the drop seen the moment the reveal is opened.
  useEffect(() => {
    if (firedSeen.current) return;
    firedSeen.current = true;
    if (!card.seenAt) seen.mutate(card.id);
  }, [card.id, card.seenAt, seen]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  function reveal() {
    if (reduced.current) {
      setPhase("revealed");
      return;
    }
    setPhase("revealing");
    revealTimer.current = setTimeout(() => setPhase("revealed"), 620);
  }

  const stampClick = () => clicked.mutate(card.id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your daily drop"
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm inkd-reveal-backdrop"
    >
      <style>{REVEAL_KEYFRAMES}</style>

      {/* Ink-spread transition burst */}
      {phase === "revealing" && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-ember inkd-ink-spread"
        />
      )}

      <div className="relative w-full max-w-md">
        {phase === "teaser" ? (
          <TeaserPanel onReveal={reveal} onDismiss={onDismiss} />
        ) : (
          <div className={cx("flex flex-col", phase === "revealed" && "inkd-reveal-in")}>
            <RevealedPanel
              image={image}
              subjectId={card.subjectId}
              isFlash={isFlash}
              reason={card.reason}
              artistName={artistName}
              artistHref={artistHref}
              styleTags={styleTags.map((s) => s.name)}
              location={location}
              priceCents={card.flash?.priceCents ?? null}
              onArtist={stampClick}
              onDismiss={onDismiss}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TeaserPanel({ onReveal, onDismiss }: { onReveal: () => void; onDismiss: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-md border border-border-accent bg-surface-base px-8 py-12 text-center shadow-2xl inkd-teaser-in">
      <span className="relative inline-flex">
        <span
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full bg-surface-ember/25 blur-2xl inkd-halo"
        />
        <LogoDropMark size={84} animate />
      </span>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-content-ember">
          INKD · Daily Drop
        </span>
        <h2 className="font-hand text-4xl leading-tight text-content-primary">
          Your daily drop is in
        </h2>
        <p className="max-w-xs text-sm text-content-secondary">
          One piece, picked for your taste today. Reveal it.
        </p>
      </div>

      <button
        type="button"
        onClick={onReveal}
        className="inline-flex items-center gap-2 rounded-sm bg-brand px-6 py-3 font-sans text-base font-semibold text-brand-on outline-none transition-colors hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Icon name="sparkles" size={17} />
        Reveal my drop
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted outline-none hover:text-content-primary focus-visible:text-content-primary"
      >
        Maybe later
      </button>
    </div>
  );
}

function RevealedPanel({
  image,
  subjectId,
  isFlash,
  reason,
  artistName,
  artistHref,
  styleTags,
  location,
  priceCents,
  onArtist,
  onDismiss,
}: {
  image: string | null;
  subjectId: string;
  isFlash: boolean;
  reason: string;
  artistName: string;
  artistHref: string | null;
  styleTags: string[];
  location: string;
  priceCents: number | null;
  onArtist: () => void;
  onDismiss: () => void;
}) {
  return (
    <section
      aria-label="Today's drop"
      className="overflow-hidden rounded-md border border-border-accent bg-surface-base shadow-2xl"
    >
      <div
        className="relative"
        style={{ background: artworkGradient(`drop:${subjectId}`, { ember: isFlash }) }}
      >
        <div className="relative aspect-[16/11]">
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={reason} className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-brand px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand-on">
              <LogoDropMark size={13} tone="on-brand" />
              {isFlash ? "Flash drop" : "Today's drop"}
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-sm bg-black/45 text-neutral-50 outline-none backdrop-blur-sm transition-colors hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-content-ember">
            Picked for you
          </span>
          <p className="font-hand text-2xl leading-tight text-content-primary">{reason}</p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-display text-base font-bold text-content-primary">
              {artistName}
            </span>
            <span className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-content-muted">
              {styleTags.length > 0 ? styleTags.slice(0, 2).join(" · ") : "Tattoo"}
              {location && <> · {location}</>}
            </span>
          </div>
          {isFlash && (
            <span className="shrink-0 font-hand text-2xl leading-none text-content-ember">
              {flashPriceLabel(priceCents)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {artistHref && (
            <Link
              href={artistHref}
              onClick={onArtist}
              className="inline-flex items-center gap-1.5 rounded-sm bg-brand px-4 py-2 font-sans text-sm font-semibold text-brand-on outline-none transition-colors hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand"
            >
              {isFlash ? "Book this flash" : "View artist"}
              <Icon name="arrow-right" size={15} />
            </Link>
          )}
          <Link
            href="/daily-drop"
            onClick={onArtist}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border px-4 py-2 font-sans text-sm font-medium text-content-secondary outline-none transition-colors hover:border-border-strong hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand"
          >
            View the piece
          </Link>
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted outline-none hover:text-content-primary focus-visible:text-content-primary"
          >
            Dismiss
          </button>
        </div>
      </div>
    </section>
  );
}

// Keyframes kept local (dependency-free). All motion is suppressed under
// prefers-reduced-motion so the takeover simply appears.
const REVEAL_KEYFRAMES = `
@keyframes inkd-drop-bob { 0%,100% { transform: translateY(0) scale(1);} 50% { transform: translateY(2px) scale(1.06);} }
@keyframes inkd-halo { 0%,100% { opacity:.5; transform:scale(1);} 50% { opacity:.9; transform:scale(1.15);} }
@keyframes inkd-teaser-in { from { opacity:0; transform: translateY(10px) scale(.98);} to { opacity:1; transform:none;} }
@keyframes inkd-reveal-in { from { opacity:0; transform: translateY(14px) scale(.96);} to { opacity:1; transform:none;} }
@keyframes inkd-backdrop-in { from { opacity:0;} to { opacity:1;} }
@keyframes inkd-ink-spread { 0% { opacity:.85; transform: translate(-50%,-50%) scale(.2);} 100% { opacity:0; transform: translate(-50%,-50%) scale(16);} }
.inkd-teaser-in { animation: inkd-teaser-in .4s cubic-bezier(.2,.7,.2,1) both; }
.inkd-reveal-in { animation: inkd-reveal-in .5s cubic-bezier(.2,.7,.2,1) both; }
.inkd-reveal-backdrop { animation: inkd-backdrop-in .25s ease both; }
.inkd-ink-spread { animation: inkd-ink-spread .62s ease-out both; }
.inkd-halo { animation: inkd-halo 2.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .inkd-teaser-in, .inkd-reveal-in, .inkd-reveal-backdrop, .inkd-ink-spread, .inkd-halo { animation: none !important; }
}
`;
