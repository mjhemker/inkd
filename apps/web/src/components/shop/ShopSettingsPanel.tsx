"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Icon,
  Input,
  Spinner,
  TextArea,
  useToast,
} from "@inkd/ui/web";
import {
  shopModeLabel,
  useMyShop,
  useMyShopInvites,
  useMyShopMemberships,
  useShopInviteActions,
  useShopMutations,
} from "@inkd/core";

/**
 * Settings → Shop. Two jobs:
 *   1. Become / manage a shop (an artist-account capability; one shop per profile).
 *   2. Respond to invites from OTHER shops, and see the shops you belong to.
 */
export function ShopSettingsPanel() {
  const { data: shop, isLoading } = useMyShop();

  if (isLoading) {
    return (
      <div className="grid min-h-[20vh] place-items-center">
        <Spinner size={22} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {shop ? <ManageShopCard shopName={shop.name} shopHandle={shop.handle} published={shop.is_published} avatarUrl={shop.avatar_url} /> : <CreateShopCard />}
      <MyInvitesCard />
      <MyMembershipsCard />
    </div>
  );
}

function ManageShopCard({
  shopName,
  shopHandle,
  published,
  avatarUrl,
}: {
  shopName: string;
  shopHandle: string;
  published: boolean;
  avatarUrl: string | null;
}) {
  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar src={avatarUrl ?? undefined} name={shopName} size="lg" shape="square" />
        <div className="flex flex-1 flex-col">
          <span className="text-base font-semibold text-content-primary">{shopName}</span>
          <span className="font-mono text-sm text-content-muted">@{shopHandle}</span>
        </div>
        <Badge variant={published ? "success" : "neutral"}>{published ? "Published" : "Draft"}</Badge>
      </div>
      <p className="text-sm text-content-secondary">
        You own a shop. Manage its roster, membership modes, profile and locations from the shop
        dashboard.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/studio/shop">
          <Button>
            Manage shop
            <Icon name="arrow-right" size={16} />
          </Button>
        </Link>
        <Link href={`/s/${shopHandle}`} target="_blank">
          <Button variant="outline">View public page</Button>
        </Link>
      </div>
    </Card>
  );
}

function CreateShopCard() {
  const { toast } = useToast();
  const { create } = useShopMutations();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");

  async function submit() {
    if (!name.trim() || !handle.trim()) return;
    try {
      await create.mutateAsync({
        name: name.trim(),
        handle: handle.trim().replace(/^@/, ""),
        bio: bio.trim() || null,
      });
      toast({ title: "Shop created", description: "Add your roster and publish when ready.", variant: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Couldn't create shop",
        description: /duplicate|unique/i.test(msg) ? "That handle is taken." : msg,
        variant: "danger",
      });
    }
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-surface-overlay text-content-accent">
          <Icon name="layout-grid" size={22} />
        </span>
        <h2 className="font-display text-xl font-bold tracking-tight">Create a shop</h2>
        <p className="max-w-md text-content-secondary">
          A shop is an artist account that hosts other artists — as a promotional showcase or a full
          management layer. You can run a shop and keep your own artist profile. One shop per account.
        </p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-content-secondary">Shop name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fells Point Ink" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-content-secondary">Handle</span>
        <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="fells-point-ink" />
        <span className="text-xs text-content-muted">Your public page will be /s/{handle.trim().replace(/^@/, "") || "your-shop"}</span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-content-secondary">Bio (optional)</span>
        <TextArea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
      </label>
      <Button onClick={() => void submit()} loading={create.isPending} className="self-start">
        Create shop
      </Button>
    </Card>
  );
}

function MyInvitesCard() {
  const { toast } = useToast();
  const { data: invites, isLoading } = useMyShopInvites();
  const { accept, decline } = useShopInviteActions();
  if (isLoading || !invites || invites.length === 0) return null;

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-lg font-bold tracking-tight">Shop invites</h3>
        <p className="text-sm text-content-secondary">
          Shops that invited you to join. You choose whether to accept.
        </p>
      </div>
      {invites.map((invite) => (
        <div
          key={invite.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4"
        >
          <div className="flex items-center gap-3">
            <Avatar src={invite.shop?.avatar_url ?? undefined} name={invite.shop?.name ?? "Shop"} size="md" shape="square" />
            <div className="flex flex-col">
              <span className="font-semibold text-content-primary">{invite.shop?.name ?? "A shop"}</span>
              <span className="text-xs text-content-muted">
                Invited as {shopModeLabel(invite.membership_mode)} · {invite.role}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              loading={accept.isPending}
              onClick={() =>
                void accept
                  .mutateAsync(invite.id)
                  .then(() => toast({ title: "Joined shop", variant: "success" }))
                  .catch((err) => toast({ title: "Couldn't accept", description: String(err), variant: "danger" }))
              }
            >
              <Icon name="check" size={15} />
              Accept
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void decline
                  .mutateAsync(invite.id)
                  .then(() => toast({ title: "Invite declined" }))
                  .catch((err) => toast({ title: "Couldn't decline", description: String(err), variant: "danger" }))
              }
            >
              Decline
            </Button>
          </div>
        </div>
      ))}
    </Card>
  );
}

function MyMembershipsCard() {
  const { toast } = useToast();
  const { data: memberships, isLoading } = useMyShopMemberships();
  const { leave } = useShopInviteActions();
  // Hide the owner's own shop membership here (managed from the dashboard).
  const joined = (memberships ?? []).filter((m) => m.role !== "owner");
  if (isLoading || joined.length === 0) return null;

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-lg font-bold tracking-tight">Shops you belong to</h3>
      </div>
      {joined.map((m) => (
        <div
          key={m.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4"
        >
          <div className="flex items-center gap-3">
            <Avatar src={m.shop?.avatar_url ?? undefined} name={m.shop?.name ?? "Shop"} size="md" shape="square" />
            <div className="flex flex-col">
              <Link
                href={m.shop?.handle ? `/s/${m.shop.handle}` : "#"}
                className="font-semibold text-content-primary hover:text-content-accent"
              >
                {m.shop?.name ?? "A shop"}
              </Link>
              <span className="text-xs text-content-muted">
                {shopModeLabel(m.membership_mode)} · {m.role}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger-500 hover:bg-danger-500/10"
            loading={leave.isPending}
            onClick={() =>
              void leave
                .mutateAsync(m.id)
                .then(() => toast({ title: "Left shop", variant: "success" }))
                .catch((err) => toast({ title: "Couldn't leave", description: String(err), variant: "danger" }))
            }
          >
            Leave
          </Button>
        </div>
      ))}
    </Card>
  );
}
