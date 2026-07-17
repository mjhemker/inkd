"use client";

import Link from "next/link";
import { Eyebrow, Skeleton, cx } from "@inkd/ui/web";
import {
  useCurrentProfile,
  useDropHistory,
  useTodayDropLive,
  type DailyDropCard as DailyDropCardData,
} from "@inkd/core";
import { artworkGradient } from "@/components/feed/artwork";
import { DailyDropCard } from "./DailyDropCard";

/**
 * The dedicated Daily Drop surface (`/daily-drop`) — the deep-link target of the
 * daily notification. Today's pick up top (the full, editorial treatment) and a
 * "Recent drops" history strip below (the lightweight engagement loop).
 */
export function DailyDropSurface() {
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const signedIn = Boolean(profile);
  const drop = useTodayDropLive();
  const history = useDropHistory({ limit: 14 });

  const todayCard = drop.card;
  const past = (history.data ?? []).filter((d) => d.id !== todayCard?.id);
  const loading = profileLoading || drop.status === "loading" || drop.status === "generating";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <Eyebrow>INKD · daily drop</Eyebrow>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Your daily drop</h1>
        <p className="max-w-xl text-sm text-content-secondary">
          One piece a day, picked from the styles you love and the artists you follow. A fresh reason to look.
        </p>
      </header>

      {loading ? (
        <Skeleton className="aspect-[16/10] w-full rounded-sm sm:aspect-[2/1]" />
      ) : todayCard ? (
        <DailyDropCard card={todayCard} variant="full" signedIn={signedIn} />
      ) : (
        <DropEmptyState signedIn={signedIn} />
      )}

      {past.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-content-muted">
            Recent drops
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {past.map((d) => (
              <HistoryTile key={d.id} card={d} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function HistoryTile({ card }: { card: DailyDropCardData }) {
  const isFlash = card.subjectType === "flash";
  const image = isFlash ? card.flash?.imageUrl ?? null : card.post?.coverUrl ?? null;
  const handle = card.artist?.handle ?? null;
  const artistName = card.artist?.displayName ?? (handle ? `@${handle}` : "INKD artist");
  const href = handle ? `/a/${handle}` : "/daily-drop";

  return (
    <li>
      <Link
        href={href}
        className="group flex flex-col overflow-hidden rounded-sm border border-border-subtle bg-surface-base outline-none transition-colors hover:border-border-accent focus-visible:ring-2 focus-visible:ring-brand"
      >
        <div
          className="relative aspect-square w-full"
          style={{ background: artworkGradient(`drop:${card.subjectId}`, { ember: isFlash }) }}
        >
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={card.reason} className="absolute inset-0 h-full w-full object-cover" />
          )}
          <span
            className={cx(
              "absolute left-1.5 top-1.5 rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em]",
              isFlash ? "bg-surface-ember text-brand-on-ember" : "bg-black/55 text-neutral-50",
            )}
          >
            {isFlash ? "Flash" : "Post"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 px-2.5 py-2">
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-content-muted">
            {formatDropDate(card.dropDate)}
          </span>
          <span className="truncate font-sans text-xs font-semibold text-content-primary">{artistName}</span>
        </div>
      </Link>
    </li>
  );
}

function DropEmptyState({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-sm border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
      <p className="-rotate-2 font-hand text-3xl leading-tight text-content-ember">
        {signedIn ? "your first drop lands tomorrow morning" : "sign in to get your daily drop"}
      </p>
      <p className="max-w-sm text-sm text-content-secondary">
        Every morning we pick one piece for you from the styles you love and the artists you follow. Follow a
        few artists and save the work that catches your eye to sharpen tomorrow&apos;s pick.
      </p>
      <Link
        href="/discover"
        className="rounded-sm bg-brand px-4 py-2 font-sans text-sm font-semibold text-brand-on outline-none transition-colors hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand"
      >
        Discover artists
      </Link>
    </div>
  );
}

function formatDropDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
