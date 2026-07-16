"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Eyebrow,
  Icon,
  Input,
  Select,
  Spinner,
  Tabs,
  TextArea,
  Toggle,
  useToast,
} from "@inkd/ui/web";
import {
  SHOP_MEMBERSHIP_MODES,
  SHOP_MEMBER_ROLES,
  shopMemberCapabilities,
  useCurrentArtistProfile,
  useCurrentProfile,
  useMyShop,
  useShopManagedAgenda,
  useShopMemberMutations,
  useShopMutations,
  useShopRoster,
  type ShopMemberRole,
  type ShopMembershipMode,
  type ShopRosterMember,
} from "@inkd/core";
import { LocationsEditor } from "@/components/artist";

const TABS = [
  { value: "roster", label: "Roster" },
  { value: "calendar", label: "Managed calendar" },
  { value: "profile", label: "Shop profile" },
  { value: "locations", label: "Locations" },
];

export function ShopDashboardView() {
  const { data: profile, isLoading: pLoading } = useCurrentProfile();
  const { data: artist, isLoading: aLoading } = useCurrentArtistProfile();
  const { data: shop, isLoading: sLoading } = useMyShop();
  const [tab, setTab] = useState("roster");

  if (pLoading || aLoading || sLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner size={26} />
      </div>
    );
  }

  // Nav only shows this to shop owners, but guard anyway.
  if (!artist || !shop) {
    return (
      <Card padding="lg" className="flex flex-col items-start gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-surface-overlay text-content-accent">
          <Icon name="layout-grid" size={22} />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-xl font-bold tracking-tight">Create your shop</h2>
          <p className="max-w-md text-content-secondary">
            Turn your artist account into a shop that hosts other artists — as a promotional
            showcase or a full management layer.
          </p>
        </div>
        <Link href="/settings?tab=shop">
          <Button>
            Set up a shop
            <Icon name="arrow-right" size={16} />
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Eyebrow>Shop</Eyebrow>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar src={shop.avatar_url ?? undefined} name={shop.name} size="lg" shape="square" />
            <div className="flex flex-col">
              <h1 className="font-display text-3xl font-extrabold tracking-tight">{shop.name}</h1>
              <span className="font-mono text-sm text-content-muted">@{shop.handle}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={shop.is_published ? "success" : "neutral"}>
              {shop.is_published ? "Published" : "Draft"}
            </Badge>
            <Link href={`/s/${shop.handle}`} target="_blank">
              <Button variant="outline" size="sm">
                View public page
                <Icon name="arrow-right" size={15} />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} items={TABS} className="overflow-x-auto overflow-y-hidden" />

      <div className="max-w-4xl">
        {tab === "roster" && <RosterPanel shopId={shop.id} invitedBy={profile?.id ?? null} />}
        {tab === "calendar" && <ManagedCalendarPanel shopId={shop.id} />}
        {tab === "profile" && <ShopProfilePanel />}
        {tab === "locations" && <LocationsEditor artist={artist} variant="settings" />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------
function RosterPanel({ shopId, invitedBy }: { shopId: string; invitedBy: string | null }) {
  const { data: roster, isLoading } = useShopRoster(shopId);
  const members = roster ?? [];
  const owner = members.find((m) => m.role === "owner");
  const active = members.filter((m) => m.role !== "owner" && m.status === "active");
  const invited = members.filter((m) => m.status === "invited");

  return (
    <div className="flex flex-col gap-8">
      <InviteForm shopId={shopId} invitedBy={invitedBy} />

      {isLoading ? (
        <Spinner size={22} />
      ) : (
        <>
          {invited.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-content-muted">
                Pending invites
              </h3>
              {invited.map((m) => (
                <MemberRow key={m.id} member={m} shopId={shopId} />
              ))}
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-content-muted">
              Roster
            </h3>
            {owner && <MemberRow member={owner} shopId={shopId} readOnly />}
            {active.length === 0 && !owner ? (
              <Card padding="md" className="text-content-secondary">
                No members yet — invite an artist above.
              </Card>
            ) : (
              active.map((m) => <MemberRow key={m.id} member={m} shopId={shopId} />)
            )}
          </section>
        </>
      )}
    </div>
  );
}

function InviteForm({ shopId, invitedBy }: { shopId: string; invitedBy: string | null }) {
  const { toast } = useToast();
  const { inviteByHandle } = useShopMemberMutations(shopId);
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<ShopMemberRole>("resident");
  const [mode, setMode] = useState<ShopMembershipMode>("promotional");

  async function submit() {
    if (!handle.trim()) return;
    const result = await inviteByHandle.mutateAsync({
      handleOrEmail: handle.trim(),
      invitedBy,
      role,
      membershipMode: mode,
    });
    if ("error" in result) {
      toast({ title: "Couldn't send invite", description: result.error, variant: "danger" });
      return;
    }
    setHandle("");
    toast({ title: "Invite sent", description: "They'll get a notification to accept.", variant: "success" });
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-lg font-bold tracking-tight">Invite an artist</h3>
        <p className="text-sm text-content-secondary">
          Invite by @handle or email. They must accept before they join — you can&apos;t add anyone
          unilaterally.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium text-content-secondary">Handle or email</span>
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@artist or artist@email.com"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-secondary">Role</span>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as ShopMemberRole)}
            options={SHOP_MEMBER_ROLES.filter((r) => r.value !== "owner").map((r) => ({
              value: r.value,
              label: r.label,
            }))}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-secondary">Mode</span>
          <Select
            value={mode}
            onChange={(e) => setMode(e.target.value as ShopMembershipMode)}
            options={SHOP_MEMBERSHIP_MODES.map((m) => ({ value: m.value, label: m.label }))}
          />
        </label>
      </div>
      <p className="text-xs text-content-muted">
        {SHOP_MEMBERSHIP_MODES.find((m) => m.value === mode)?.description}
      </p>
      <Button onClick={() => void submit()} loading={inviteByHandle.isPending} className="self-start">
        <Icon name="plus" size={16} />
        Send invite
      </Button>
    </Card>
  );
}

function MemberRow({
  member,
  shopId,
  readOnly = false,
}: {
  member: ShopRosterMember;
  shopId: string;
  readOnly?: boolean;
}) {
  const { toast } = useToast();
  const { setRole, setMode, remove } = useShopMemberMutations(shopId);
  const profile = member.artist?.profile;
  const name = profile?.display_name || (profile?.handle ? `@${profile.handle}` : "Artist");
  const caps = shopMemberCapabilities(member);

  return (
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar src={profile?.avatar_url ?? undefined} name={name} size="md" />
          <div className="flex flex-col">
            <Link
              href={profile?.handle ? `/a/${profile.handle}` : "#"}
              className="font-semibold text-content-primary hover:text-content-accent"
            >
              {name}
            </Link>
            {profile?.handle && (
              <span className="font-mono text-xs text-content-muted">@{profile.handle}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {member.status === "invited" && <Badge variant="warning" size="sm">Invited</Badge>}
          {member.role === "owner" && <Badge variant="ember" size="sm">Owner</Badge>}
          {caps.shopCanViewAgenda && (
            <Badge variant="brand" size="sm">
              <Icon name="calendar" size={12} />
              Calendar shared
            </Badge>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-content-muted">Role</span>
            <Select
              size="sm"
              value={member.role}
              onChange={(e) =>
                void setRole
                  .mutateAsync({ memberId: member.id, role: e.target.value as ShopMemberRole })
                  .catch((err) =>
                    toast({ title: "Couldn't update role", description: String(err), variant: "danger" }),
                  )
              }
              options={SHOP_MEMBER_ROLES.filter((r) => r.value !== "owner").map((r) => ({
                value: r.value,
                label: r.label,
              }))}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-content-muted">Mode</span>
            <Select
              size="sm"
              value={member.membership_mode}
              onChange={(e) =>
                void setMode
                  .mutateAsync({ memberId: member.id, mode: e.target.value as ShopMembershipMode })
                  .catch((err) =>
                    toast({ title: "Couldn't update mode", description: String(err), variant: "danger" }),
                  )
              }
              options={SHOP_MEMBERSHIP_MODES.map((m) => ({ value: m.value, label: m.label }))}
            />
          </label>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger-500 hover:bg-danger-500/10"
            loading={remove.isPending}
            onClick={() =>
              void remove
                .mutateAsync(member.id)
                .then(() => toast({ title: "Member removed", variant: "success" }))
                .catch((err) =>
                  toast({ title: "Couldn't remove", description: String(err), variant: "danger" }),
                )
            }
          >
            <Icon name="x" size={15} />
            Remove
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Managed calendar (the management layer read)
// ---------------------------------------------------------------------------
function ManagedCalendarPanel({ shopId }: { shopId: string }) {
  const { data: agenda, isLoading } = useShopManagedAgenda(shopId);
  const rows = agenda ?? [];
  const byMember = useMemo(() => {
    const map = new Map<string, { name: string; handle: string | null; rows: typeof rows }>();
    for (const r of rows) {
      const key = r.member_artist_id;
      if (!map.has(key)) map.set(key, { name: r.member_name ?? "Artist", handle: r.member_handle, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  return (
    <div className="flex flex-col gap-5">
      <Card padding="md" className="flex items-start gap-3 border-border-accent/40 bg-surface-overlay">
        <Icon name="shield" size={18} className="mt-0.5 text-content-accent" />
        <p className="text-sm text-content-secondary">
          You only see the calendar of members on a <strong>managed</strong> membership who have
          accepted. Promotional members keep their bookings private.
        </p>
      </Card>

      {isLoading ? (
        <Spinner size={22} />
      ) : byMember.length === 0 ? (
        <Card padding="lg" className="text-content-secondary">
          No upcoming sessions from managed members yet.
        </Card>
      ) : (
        byMember.map((m) => (
          <section key={m.handle ?? m.name} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-content-primary">{m.name}</h3>
            <Card padding="none">
              {m.rows.map((r, i) => (
                <div
                  key={r.session_id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${
                    i > 0 ? "border-t border-border-subtle" : ""
                  }`}
                >
                  <span className="text-sm text-content-secondary">
                    Session #{r.session_number ?? "—"}
                  </span>
                  <span className="font-mono text-sm text-content-primary">
                    {r.scheduled_start
                      ? new Date(r.scheduled_start).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Unscheduled"}
                  </span>
                  <Badge variant="neutral" size="sm">
                    {r.session_status}
                  </Badge>
                </div>
              ))}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shop profile
// ---------------------------------------------------------------------------
function ShopProfilePanel() {
  const { toast } = useToast();
  const { data: shop } = useMyShop();
  const { update, setPublished, remove } = useShopMutations();
  const [name, setName] = useState(shop?.name ?? "");
  const [bio, setBio] = useState(shop?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(shop?.avatar_url ?? "");

  if (!shop) return null;

  async function save() {
    try {
      await update.mutateAsync({
        shopId: shop!.id,
        patch: {
          name: name.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        },
      });
      toast({ title: "Shop saved", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't save", description: String(err), variant: "danger" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card padding="lg" className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-secondary">Shop name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-secondary">Handle</span>
          <Input value={shop.handle} disabled />
          <span className="text-xs text-content-muted">
            Your public page is /s/{shop.handle}
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-secondary">Bio</span>
          <TextArea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-secondary">Avatar URL</span>
          <Input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <Button onClick={() => void save()} loading={update.isPending} className="self-start">
          Save shop
        </Button>
      </Card>

      <Card padding="lg" className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-content-primary">Publish shop</span>
          <span className="text-sm text-content-secondary">
            When published, your shop appears in Discover and its public page is live.
          </span>
        </div>
        <Toggle
          checked={shop.is_published}
          onCheckedChange={(v) =>
            void setPublished
              .mutateAsync({ shopId: shop.id, isPublished: v })
              .then(() => toast({ title: v ? "Shop published" : "Shop unpublished", variant: "success" }))
              .catch((err) => toast({ title: "Couldn't update", description: String(err), variant: "danger" }))
          }
        />
      </Card>

      <Card padding="lg" className="flex flex-col gap-3 border-danger-500/40 bg-danger-500/5">
        <span className="text-sm font-medium text-danger-500">Delete shop</span>
        <p className="text-sm text-content-secondary">
          Removes the shop and its roster. Member artists&apos; own accounts and data are untouched.
        </p>
        <Button
          variant="outline"
          className="self-start border-danger-500/50 text-danger-500 hover:bg-danger-500/10"
          loading={remove.isPending}
          onClick={() =>
            void remove
              .mutateAsync(shop.id)
              .then(() => toast({ title: "Shop deleted", variant: "success" }))
              .catch((err) => toast({ title: "Couldn't delete", description: String(err), variant: "danger" }))
          }
        >
          <Icon name="alert-triangle" size={15} />
          Delete shop
        </Button>
      </Card>
    </div>
  );
}
