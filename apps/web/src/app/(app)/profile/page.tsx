"use client";

import { useState } from "react";
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
import { useCurrentArtistProfile, useCurrentProfile } from "@inkd/core";
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

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <Eyebrow>Your profile</Eyebrow>
          <div className="flex items-center gap-2">
            {isArtist && artist?.is_published && profile.handle && (
              <LinkButton href={`/a/${profile.handle}`} variant="secondary" size="sm">
                <Icon name="compass" size={16} />
                View public profile
              </LinkButton>
            )}
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
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
            {isArtist && artist?.tagline && (
              <p className="text-sm text-content-secondary">{artist.tagline}</p>
            )}
            {!isArtist && profile.bio && (
              <p className="text-sm text-content-secondary">{profile.bio}</p>
            )}
            {(profile.city || profile.state) && (
              <p className="flex items-center gap-1.5 text-xs text-content-muted">
                <Icon name="map-pin" size={13} />
                {[profile.city, profile.state].filter(Boolean).join(", ")}
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
                <Badge variant={artist.accepts_new_clients ? "brand" : "neutral"} size="sm">
                  {artist.accepts_new_clients ? "Accepting new clients" : "Not accepting clients"}
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
