"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  Avatar,
  Badge,
  Card,
  Eyebrow,
  Icon,
  Tabs,
  type IconName,
  type TabItem,
} from "@inkd/ui/web";
import { formatRatingAvg, summarizeReviews } from "@inkd/core";
import { LinkButton } from "@/components/link-button";
import {
  bookingWindowLabel,
  classificationLabel,
  flashPriceLabel,
  hoursSummary,
  servicePriceLabel,
  travelBadges,
} from "@/lib/format";
import type { PublicArtistData } from "../data";
import { Lightbox, type LightboxImage } from "./Lightbox";
import { ReviewsTab } from "@/components/reviews/reviews-tab";

const TABS: TabItem[] = [
  { value: "portfolio", label: "Portfolio" },
  { value: "posts", label: "Posts" },
  { value: "flash", label: "Flash" },
  { value: "reviews", label: "Reviews" },
  { value: "info", label: "Info" },
];

// Deterministic hero wash so every artist page has a distinct backdrop before
// real cover art exists — keyed off the handle so it's stable per artist. The
// hero is theme-aware (no longer a fixed dark island): a deep violet-leaning
// wash on the near-black wall in DARK, a soft paper-tinted wash in LIGHT. Both
// variants share the same per-handle index so the identity stays consistent
// across a theme flip; the active one is chosen by `.profile-hero` CSS. Per the
// zine pass the wash is kept SUBTLE — a flat, hairline-separated header area,
// not a heavy matte island — so the one hero (Request a booking) owns the eye.
const HERO_GRADIENTS_DARK = [
  "linear-gradient(160deg,#1c1526,#0a0a0b 68%)",
  "linear-gradient(160deg,#181530,#0a0a0b 68%)",
  "linear-gradient(160deg,#26141f,#0a0a0b 68%)",
  "linear-gradient(160deg,#131b2c,#0a0a0b 68%)",
  "linear-gradient(160deg,#1f1326,#0a0a0b 68%)",
];
const HERO_GRADIENTS_LIGHT = [
  "linear-gradient(160deg,#efe9f6,#f6f2e9 70%)",
  "linear-gradient(160deg,#eae7f6,#f6f2e9 70%)",
  "linear-gradient(160deg,#f3e9f0,#f6f2e9 70%)",
  "linear-gradient(160deg,#e8eef6,#f6f2e9 70%)",
  "linear-gradient(160deg,#f0e8f2,#f6f2e9 70%)",
];

function gradientIndexFor(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % HERO_GRADIENTS_DARK.length;
}

export function ArtistProfileView({ data }: { data: PublicArtistData }) {
  const { profile, artist, isOwnProfile } = data;
  const [tab, setTab] = useState("portfolio");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const displayName = profile.display_name || profile.handle || "Artist";
  const gradientIndex = gradientIndexFor(profile.handle ?? profile.id);
  const primaryLocation = data.studioLocations.find((l) => l.is_primary) ?? data.studioLocations[0];
  const reviewSummary = useMemo(
    () => summarizeReviews(data.reviews.filter((r) => r.is_public)),
    [data.reviews],
  );

  const portfolioImages: LightboxImage[] = useMemo(
    () =>
      data.portfolioPieces
        .filter((p) => p.image_url)
        .map((p) => ({ src: p.image_url as string, title: p.title, caption: p.placement })),
    [data.portfolioPieces],
  );

  return (
    <div className="min-h-dvh bg-surface-base text-content-primary">
      <TopBar handle={profile.handle} />

      {isOwnProfile && (
        <div className="border-b border-border-subtle bg-surface-plate-ink">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-2.5 text-sm md:px-8">
            <span className="text-content-secondary">
              You&apos;re viewing your own public profile.
            </span>
            <Link href="/profile" className="font-medium text-content-accent hover:underline">
              Edit profile
            </Link>
          </div>
        </div>
      )}

      {/* Hero — theme-aware (NOT a fixed dark island). Descendants use ordinary
          theme tokens, so text is light-on-dark in dark mode and ink-on-paper in
          light mode. `.profile-hero` picks the matching per-handle gradient var
          for the active theme (see globals.css). Flat, hairline-separated per the
          zine: the ONE hero here is the Request-a-booking button, top-right. */}
      <section
        className="profile-hero relative overflow-hidden border-b border-border-subtle text-content-primary"
        style={
          {
            "--hero-grad-dark": HERO_GRADIENTS_DARK[gradientIndex],
            "--hero-grad-light": HERO_GRADIENTS_LIGHT[gradientIndex],
          } as CSSProperties
        }
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-12 md:px-8 md:py-14">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            {/* Identity cluster — avatar + name/handle/tagline + meta chips. */}
            <div className="flex flex-1 flex-col items-start gap-5 sm:flex-row sm:items-end">
              <Avatar
                src={profile.avatar_url ?? undefined}
                name={displayName}
                size="xl"
                className="border-4 border-surface-base sm:h-24 sm:w-24 lg:h-28 lg:w-28 lg:text-4xl"
              />
              <div className="flex flex-1 flex-col gap-2">
                <h1 className="font-display text-4xl font-extrabold tracking-tight text-content-primary sm:text-5xl">
                  {displayName}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-content-secondary">
                  {profile.handle && (
                    <span className="font-mono text-content-muted">@{profile.handle}</span>
                  )}
                  {artist.tagline && <span>{artist.tagline}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {primaryLocation && (
                    <Badge variant="outline" size="sm">
                      <Icon name="map-pin" size={12} />
                      {[primaryLocation.city, primaryLocation.state].filter(Boolean).join(", ")}
                    </Badge>
                  )}
                  <Badge variant="outline" size="sm">
                    {classificationLabel(artist.classification)}
                  </Badge>
                  {data.shopBadges.map((badge) => (
                    <Link key={badge.shop_id} href={`/s/${badge.handle}`}>
                      <Badge variant="outline" size="sm" className="hover:border-border-accent">
                        <Icon name="layout-grid" size={12} />@ {badge.name}
                      </Badge>
                    </Link>
                  ))}
                  {reviewSummary.count > 0 && (
                    <Badge variant="ember" size="sm">
                      {/* Classic star glyph — same 5-star family as <StarRating>,
                          so reviews iconography is uniform across the app. */}
                      <Icon name="star" size={12} />
                      {formatRatingAvg(reviewSummary.avg)} · {reviewSummary.count} review
                      {reviewSummary.count === 1 ? "" : "s"}
                    </Badge>
                  )}
                  {travelBadges(artist).map((label) => (
                    <Badge key={label} variant="outline" size="sm">
                      {label}
                    </Badge>
                  ))}
                  {/* Books-open reads as a solid GREEN status chip (open) or a
                      muted neutral chip (closed) — never violet. */}
                  <Badge variant={artist.accepts_new_clients ? "success" : "neutral"} size="sm">
                    {artist.accepts_new_clients ? "Books open" : "Books closed"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* THE hero of this screen — Request a booking, top-right. Message is
                a flat outline sibling; only the hero carries the offset shadow. */}
            {!isOwnProfile && (
              <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
                <LinkButton href={`/book/${profile.handle}`} hero className="w-full sm:w-auto">
                  <Icon name="calendar" size={18} />
                  Request a booking
                </LinkButton>
                <LinkButton
                  href={`/messages/new?to=${profile.id}`}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Icon name="message-circle" size={18} />
                  Message
                </LinkButton>
              </div>
            )}
          </div>

          {data.styles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.styles.map((style) => (
                <span
                  key={style.id}
                  className="rounded-full border border-border-subtle bg-surface-base/60 px-3 py-1 text-xs font-medium text-content-secondary backdrop-blur"
                >
                  {style.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Tabs */}
      <div className="sticky top-0 z-20 border-b border-border-subtle bg-surface-base/90 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
          <Tabs value={tab} onValueChange={setTab} items={TABS} />
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8">
        {tab === "portfolio" && (
          <PortfolioGrid pieces={data.portfolioPieces} onOpen={(i) => setLightboxIndex(i)} />
        )}
        {tab === "posts" && <PostsGrid posts={data.posts} />}
        {tab === "flash" && <FlashSection sheets={data.flashSheets} />}
        {tab === "reviews" && (
          <ReviewsTab
            reviews={data.reviews}
            reviewerProfiles={data.reviewerProfiles}
            artistName={profile.display_name || profile.handle}
          />
        )}
        {tab === "info" && <InfoTab data={data} />}
      </main>

      {lightboxIndex !== null && portfolioImages.length > 0 && (
        <Lightbox
          images={portfolioImages}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

function TopBar({ handle }: { handle: string | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-base/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-on">
            <span className="font-display text-lg font-extrabold leading-none">I</span>
          </span>
          <span className="font-display text-xl font-bold tracking-tight">INKD</span>
        </Link>
        <span className="hidden font-mono text-xs uppercase tracking-[0.18em] text-content-muted sm:inline">
          {handle ? `getinkd.co/a/${handle}` : "Artist profile"}
        </span>
      </div>
    </header>
  );
}

function PortfolioGrid({
  pieces,
  onOpen,
}: {
  pieces: PublicArtistData["portfolioPieces"];
  onOpen: (index: number) => void;
}) {
  const withImages = pieces.filter((p) => p.image_url);
  if (withImages.length === 0) {
    return <EmptyTab icon="layout-grid" title="Portfolio coming soon" description="This artist hasn't added portfolio pieces yet." />;
  }
  // Straight, flat tiles on a plain grid — hairline borders, mono caption BELOW
  // each tile (zine). No rounded cards, no elevation; the artwork mats dark.
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
      {withImages.map((piece, index) => (
        <PortfolioTile key={piece.id} piece={piece} onOpen={() => onOpen(index)} />
      ))}
    </div>
  );
}

function PortfolioTile({
  piece,
  onOpen,
}: {
  piece: PublicArtistData["portfolioPieces"][number];
  onOpen: () => void;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full text-left outline-none"
    >
      <div className="overflow-hidden border border-border-subtle bg-surface-overlay group-focus-visible:ring-2 group-focus-visible:ring-brand">
        {broken ? (
          <BrokenPiecePlacard title={piece.title} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={piece.image_url as string}
            alt={piece.title ?? ""}
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="aspect-[4/5] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
      </div>
      <span className="mt-1.5 block truncate font-mono text-[11px] uppercase tracking-[0.14em] text-content-muted">
        {piece.title || piece.placement || "Untitled"}
      </span>
    </button>
  );
}

/** A fixed-square cover image (posts, flash) that degrades to a centered icon
 * placeholder both when there's no URL and when the image 404s. */
function SquareCover({
  src,
  icon,
  alt = "",
}: {
  src: string | null;
  icon: IconName;
  alt?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className="flex h-full items-center justify-center text-content-muted">
        <Icon name={icon} size={20} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className="h-full w-full object-cover"
    />
  );
}

/** Graceful placeholder for a portfolio/post image that fails to load — a
 * styled placard with the piece title, never a raw broken-image icon. */
function BrokenPiecePlacard({ title }: { title?: string | null }) {
  return (
    <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 bg-surface-raised px-4 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-overlay text-content-muted">
        <Icon name="image" size={18} />
      </span>
      <span className="line-clamp-2 text-xs font-medium text-content-secondary">
        {title || "Artwork"}
      </span>
    </div>
  );
}

function PostsGrid({ posts }: { posts: PublicArtistData["posts"] }) {
  if (posts.length === 0) {
    return <EmptyTab icon="image" title="No posts yet" description="Updates from this artist will show up here." />;
  }
  // Straight, flat tiles + mono caption below — matches the portfolio grid.
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4">
      {posts.map((post) => {
        const cover =
          post.cover_url ?? (Array.isArray(post.media) && (post.media[0] as { url?: string } | undefined)?.url);
        return (
          <div key={post.id}>
            <div className="aspect-square overflow-hidden border border-border-subtle bg-surface-overlay">
              <SquareCover src={cover || null} icon="image" />
            </div>
            {post.caption && (
              <p className="mt-1.5 line-clamp-1 font-mono text-[11px] uppercase tracking-[0.14em] text-content-muted">
                {post.caption}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FlashSection({ sheets }: { sheets: PublicArtistData["flashSheets"] }) {
  const withItems = sheets.filter((s) => s.items.length > 0);
  if (withItems.length === 0) {
    return <EmptyTab icon="sparkles" title="No flash available" description="Check back for ready-to-book designs." />;
  }
  return (
    <div className="flex flex-col gap-10">
      {withItems.map((sheet) => (
        <div key={sheet.id} className="flex flex-col gap-4">
          <div>
            <h3 className="font-display text-xl font-bold tracking-tight">{sheet.title || "Flash"}</h3>
            {sheet.description && <p className="text-sm text-content-secondary">{sheet.description}</p>}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4">
            {sheet.items.map((item) => (
              <div key={item.id}>
                <div className="relative aspect-square overflow-hidden border border-border-subtle bg-surface-overlay">
                  <SquareCover src={item.image_url ?? null} icon="sparkles" alt={item.title ?? ""} />
                  <Badge
                    variant={item.is_available ? "success" : "neutral"}
                    size="sm"
                    className="absolute left-2 top-2"
                  >
                    {item.is_available ? "Available" : "Claimed"}
                  </Badge>
                </div>
                <div className="mt-1.5 flex flex-col gap-0.5">
                  {item.title && (
                    <p className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-content-muted">
                      {item.title}
                    </p>
                  )}
                  <p className="text-xs">
                    <span className="text-money">{flashPriceLabel(item.price_cents)}</span>
                    {item.size_inches ? (
                      <span className="text-content-muted">{` · ${item.size_inches}"`}</span>
                    ) : null}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoTab({ data }: { data: PublicArtistData }) {
  const { artist, services, availabilityRules, bookingPolicy, studioLocations } = data;
  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-8">
        {artist.bio && (
          <div className="flex flex-col gap-2">
            <Eyebrow>About</Eyebrow>
            <p className="whitespace-pre-line text-content-secondary">{artist.bio}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Eyebrow>Services</Eyebrow>
          {services.length === 0 ? (
            <p className="text-sm text-content-muted">Rates aren&apos;t published yet — ask when you request a booking.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-raised">
              {services.map((service) => (
                <div key={service.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-content-primary">{service.name}</span>
                    {service.description && (
                      <span className="text-xs text-content-muted">{service.description}</span>
                    )}
                    {service.duration_minutes && (
                      <span className="text-xs text-content-muted">{service.duration_minutes} min</span>
                    )}
                  </div>
                  <span className="whitespace-nowrap text-sm text-money">
                    {servicePriceLabel(service)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Icon name="clock" size={16} className="text-content-accent" />
            <span className="text-sm font-semibold text-content-primary">Hours</span>
          </div>
          <p className="text-sm text-content-secondary">{hoursSummary(availabilityRules)}</p>
          <div className="h-px bg-border-subtle" />
          <div className="flex items-center gap-2">
            <Icon name="calendar" size={16} className="text-content-accent" />
            <span className="text-sm font-semibold text-content-primary">Booking window</span>
          </div>
          <Badge variant={bookingPolicy?.booking_window === "closed" ? "neutral" : "brand"} size="sm" className="self-start">
            {bookingWindowLabel(bookingPolicy?.booking_window)}
          </Badge>
        </Card>

        {studioLocations.length > 0 && (
          <Card className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Icon name="map-pin" size={16} className="text-content-accent" />
              <span className="text-sm font-semibold text-content-primary">Studio locations</span>
            </div>
            <div className="flex flex-col gap-3">
              {studioLocations.map((location) => (
                <div key={location.id} className="text-sm text-content-secondary">
                  <p className="font-medium text-content-primary">{location.name || "Studio"}</p>
                  <p>
                    {[location.address_line1, location.city, location.state]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function EmptyTab({ icon, title, description }: { icon: IconName; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-raised/40 px-6 py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-overlay text-content-muted">
        <Icon name={icon} size={26} />
      </div>
      <h3 className="font-sans text-base font-semibold text-content-primary">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-content-muted">{description}</p>
    </div>
  );
}
