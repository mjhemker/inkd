"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  Icon,
  Skeleton,
  Tabs,
  type TabItem,
} from "@inkd/ui/web";
import {
  useCurrentArtistProfile,
  useCurrentProfile,
  useClientReviews,
} from "@inkd/core";
import type { Profile } from "@inkd/core";
import { LinkButton } from "@/components/link-button";
import { classificationLabel, travelBadges } from "@/lib/format";
import { EditProfileModal } from "./_components/EditProfileModal";
import { PostsPanel } from "./_components/PostsPanel";
import { PortfolioPanel } from "./_components/PortfolioPanel";
import { FlashPanel } from "./_components/FlashPanel";

const TABS: TabItem[] = [
  { value: "portfolio", label: "Portfolio" },
  { value: "posts", label: "Posts" },
  { value: "flash", label: "Flash" },
];

export default function ProfilePage() {
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const { data: artist, isLoading: artistLoading } = useCurrentArtistProfile();
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState("portfolio");

  if (profileLoading || artistLoading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface-raised/40">
        <EmptyState
          icon={<Icon name="user" size={26} />}
          title="Sign in to manage your profile"
          description="Your profile — portfolio, posts, and flash — lives here once you're signed in."
          action={
            <LinkButton href="/auth" size="sm">
              Sign in
            </LinkButton>
          }
        />
      </div>
    );
  }

  const isArtist = Boolean(artist);

  // Clients get a simple client profile — their saves, reviews and bookings —
  // not the artist portfolio editor.
  if (!isArtist) {
    return (
      <>
        <ClientProfileView profile={profile} onEdit={() => setEditOpen(true)} />
        <EditProfileModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          profile={profile}
          artist={null}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <Eyebrow>Your profile</Eyebrow>
          <div className="flex items-center gap-2">
            {isArtist && artist?.is_published && profile.handle && (
              <LinkButton href={`/a/${profile.handle}`} variant="outline" size="sm">
                <Icon name="compass" size={16} />
                View public profile
              </LinkButton>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Icon name="settings" size={16} />
              Edit profile
            </Button>
          </div>
        </div>

        <Card className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar
            src={profile.avatar_url ?? undefined}
            name={profile.display_name ?? profile.handle ?? "You"}
            size="xl"
          />
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-content-primary">
                {profile.display_name || "Add your name"}
              </h1>
              {isArtist && (
                <Badge variant={artist?.is_published ? "success" : "outline"} size="sm">
                  {artist?.is_published ? "Published" : "Unpublished"}
                </Badge>
              )}
            </div>
            {profile.handle && (
              <p className="font-mono text-sm text-content-muted">@{profile.handle}</p>
            )}
            {/* Tagline · location on one line (zine identity cluster). */}
            {isArtist && artist && (artist.tagline || profile.city || profile.state) && (
              <p className="text-sm text-content-secondary">
                {[artist.tagline, [profile.city, profile.state].filter(Boolean).join(", ")]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {isArtist && artist && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge variant="outline" size="sm">
                  {classificationLabel(artist.classification)}
                </Badge>
                {travelBadges(artist).map((label) => (
                  <Badge key={label} variant="outline" size="sm">
                    {label}
                  </Badge>
                ))}
                {/* Books-open reads as a solid GREEN status chip — never violet. */}
                <Badge variant={artist.accepts_new_clients ? "success" : "neutral"} size="sm">
                  {artist.accepts_new_clients ? "Books open" : "Books closed"}
                </Badge>
              </div>
            )}
          </div>
        </Card>
      </header>

      {isArtist && artist ? (
        <section className="flex flex-col gap-5">
          <Tabs value={tab} onValueChange={setTab} items={TABS} />
          {tab === "portfolio" && <PortfolioPanel artistId={artist.id} userId={profile.id} />}
          {tab === "posts" && <PostsPanel artistId={artist.id} userId={profile.id} />}
          {tab === "flash" && <FlashPanel artistId={artist.id} userId={profile.id} />}
        </section>
      ) : (
        <div className="rounded-2xl border border-border-subtle bg-surface-raised/40">
          <EmptyState
            icon={<Icon name="sparkles" size={26} />}
            title="Set up your artist tools"
            description="Turn on your studio to publish a portfolio, post flash, and open bookings."
            action={
              <LinkButton href="/onboarding" size="sm">
                Become an artist
              </LinkButton>
            }
          />
        </div>
      )}

      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        artist={artist ?? null}
      />
    </div>
  );
}

function ClientProfileView({
  profile,
  onEdit,
}: {
  profile: Profile;
  onEdit: () => void;
}) {
  const { data: reviews, isLoading: reviewsLoading } = useClientReviews(profile.id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <Eyebrow>Your profile</Eyebrow>
          <Button size="sm" variant="secondary" onClick={onEdit}>
            <Icon name="settings" size={16} />
            Edit profile
          </Button>
        </div>

        <Card className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar
            src={profile.avatar_url ?? undefined}
            name={profile.display_name ?? profile.handle ?? "You"}
            size="xl"
          />
          <div className="flex flex-1 flex-col gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-content-primary">
              {profile.display_name || "Add your name"}
            </h1>
            {profile.handle && (
              <p className="font-mono text-sm text-content-muted">@{profile.handle}</p>
            )}
            {profile.bio && (
              <p className="text-sm text-content-secondary">{profile.bio}</p>
            )}
            {(profile.city || profile.state) && (
              <p className="flex items-center gap-1.5 text-xs text-content-muted">
                <Icon name="map-pin" size={13} />
                {[profile.city, profile.state].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </Card>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <ClientLinkCard
          href="/bookings"
          icon="calendar"
          title="Your bookings"
          description="Requests, upcoming sessions, and past work."
        />
        <ClientLinkCard
          href="/discover"
          icon="compass"
          title="Saved artists & work"
          description="Everything you've saved while browsing."
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-bold tracking-tight">Your reviews</h2>
        {reviewsLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !reviews || reviews.length === 0 ? (
          <div className="rounded-2xl border border-border-subtle bg-surface-raised/40">
            <EmptyState
              icon={<Icon name="star" size={26} />}
              title="No reviews yet"
              description="After a session, you can leave a review for your artist — they'll show up here."
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {reviews.map((review) => (
              <li key={review.id}>
                <Card className="flex flex-col gap-2">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Icon
                        key={i}
                        name="star"
                        size={15}
                        className={
                          i < review.rating
                            ? "text-content-accent"
                            : "text-content-muted"
                        }
                      />
                    ))}
                  </div>
                  {review.body && (
                    <p className="text-sm text-content-secondary">{review.body}</p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ClientLinkCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: "calendar" | "compass";
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base rounded-2xl">
      <Card className="flex w-full items-center gap-4 transition-colors hover:border-border-accent">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-overlay text-content-accent">
          <Icon name={icon} size={20} />
        </span>
        <span className="flex flex-1 flex-col text-left">
          <span className="text-sm font-semibold text-content-primary">{title}</span>
          <span className="text-xs text-content-muted">{description}</span>
        </span>
        <Icon name="arrow-right" size={16} className="text-content-muted" />
      </Card>
    </Link>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start gap-5">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    </div>
  );
}
