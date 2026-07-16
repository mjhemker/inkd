import Link from "next/link";
import { Avatar, Badge, Card, Eyebrow, Icon, Logo } from "@inkd/ui/web";
import { shopModeLabel, shopRoleLabel } from "@inkd/core";
import { classificationLabel } from "@/lib/format";
import type { PublicShopData } from "../data";

// Deterministic violet-leaning hero wash, keyed off the shop handle — same
// family as the artist page so shop + artist pages read as one system.
const GRADIENTS = [
  "linear-gradient(160deg,#241733,#0a0a0b 70%)",
  "linear-gradient(160deg,#1c1340,#0a0a0b 70%)",
  "linear-gradient(160deg,#331327,#0a0a0b 70%)",
  "linear-gradient(160deg,#15213a,#0a0a0b 70%)",
];
function gradientFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length]!;
}

export function ShopProfileView({ data }: { data: PublicShopData }) {
  const { shop, isOwner, locations, members } = data;
  const primaryLocation =
    locations.find((l) => l.id === shop.primary_location_id) ??
    locations.find((l) => l.is_primary) ??
    locations[0];
  const roster = members.filter((m) => m.role !== "owner");
  const owner = members.find((m) => m.role === "owner");

  return (
    <div className="min-h-dvh bg-surface-base text-content-primary">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border-subtle bg-surface-base/85 px-5 backdrop-blur md:px-8">
        <Link href="/discover" aria-label="INKD" className="inline-flex items-center">
          <Logo size={30} />
        </Link>
        <span className="ml-2 font-mono text-xs uppercase tracking-[0.18em] text-content-muted">
          Shop
        </span>
      </header>

      {isOwner && (
        <div className="border-b border-border-subtle bg-surface-plate-ink">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-2.5 text-sm md:px-8">
            <span className="text-content-secondary">
              You&apos;re viewing your shop{shop.is_published ? "" : " (draft — not yet public)"}.
            </span>
            <Link href="/studio/shop" className="font-medium text-content-accent hover:underline">
              Manage shop
            </Link>
          </div>
        </div>
      )}

      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-border-subtle"
        style={{ background: gradientFor(shop.handle) }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-12 md:px-8 md:py-16">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-end">
            <Avatar
              src={shop.avatar_url ?? undefined}
              name={shop.name}
              size="xl"
              shape="square"
              className="border-4 border-surface-base"
            />
            <div className="flex flex-1 flex-col gap-2">
              <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                {shop.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-content-secondary">
                <span className="font-mono text-content-muted">@{shop.handle}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Badge variant="ember" size="sm">
                  <Icon name="layout-grid" size={12} />
                  Shop
                </Badge>
                {primaryLocation && (
                  <Badge variant="outline" size="sm">
                    <Icon name="map-pin" size={12} />
                    {[primaryLocation.city, primaryLocation.state].filter(Boolean).join(", ")}
                  </Badge>
                )}
                <Badge variant="outline" size="sm">
                  <Icon name="user" size={12} />
                  {roster.length} {roster.length === 1 ? "artist" : "artists"}
                </Badge>
              </div>
            </div>
          </div>

          {shop.bio && (
            <p className="max-w-2xl text-content-secondary">{shop.bio}</p>
          )}
        </div>
      </section>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-10 md:px-8 md:py-14">
        {/* Roster */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <Eyebrow>Artists</Eyebrow>
            <h2 className="font-display text-2xl font-bold tracking-tight">
              The {shop.name} roster
            </h2>
            {owner?.artist?.profile && (
              <p className="text-sm text-content-secondary">
                Hosted by{" "}
                <Link
                  href={`/a/${owner.artist.profile.handle}`}
                  className="font-medium text-content-accent hover:underline"
                >
                  {owner.artist.profile.display_name || `@${owner.artist.profile.handle}`}
                </Link>
                .
              </p>
            )}
          </div>

          {roster.length === 0 ? (
            <Card padding="lg" className="text-content-secondary">
              This shop hasn&apos;t added any artists to its roster yet.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {roster.map((member) => (
                <MemberCard key={member.id} member={member} />
              ))}
            </div>
          )}
        </section>

        {/* Locations */}
        {locations.length > 0 && (
          <section className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <Eyebrow>Locations</Eyebrow>
              <h2 className="font-display text-2xl font-bold tracking-tight">Where to find us</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {locations.map((loc) => (
                <Card key={loc.id} padding="md" className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-content-primary">
                    <Icon name="map-pin" size={15} className="text-content-accent" />
                    {loc.name || "Studio"}
                  </span>
                  <span className="text-sm text-content-secondary">
                    {[loc.address_line1, loc.city, loc.state, loc.postal_code]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function MemberCard({ member }: { member: PublicShopData["members"][number] }) {
  const profile = member.artist?.profile;
  const name = profile?.display_name || (profile?.handle ? `@${profile.handle}` : "Artist");
  const href = profile?.handle ? `/a/${profile.handle}` : "#";
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-raised p-5 transition-colors hover:border-border-accent"
    >
      <div className="flex items-center gap-3">
        <Avatar src={profile?.avatar_url ?? undefined} name={name} size="md" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-content-primary group-hover:text-content-accent">
            {name}
          </span>
          {profile?.handle && (
            <span className="truncate font-mono text-xs text-content-muted">@{profile.handle}</span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="neutral" size="sm">
          {shopRoleLabel(member.role)}
        </Badge>
        <Badge variant={member.membership_mode === "managed" ? "brand" : "outline"} size="sm">
          {shopModeLabel(member.membership_mode)}
        </Badge>
        {member.artist?.classification && (
          <Badge variant="outline" size="sm">
            {classificationLabel(member.artist.classification)}
          </Badge>
        )}
      </div>
    </Link>
  );
}
