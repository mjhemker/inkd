/**
 * Hooks: shops + shop membership (Wave 2). Web and mobile share one cache and
 * one loading contract. Reads are keyed hierarchically under ["shops", ...];
 * mutations invalidate the narrowest keys they affect (roster, my-shop,
 * my-memberships) plus the current profile's notifications where a trigger
 * fires one.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";

import {
  acceptShopInvite,
  createShop,
  declineShopInvite,
  deleteShop,
  getArtistShopBadges,
  getShopByHandle,
  getShopByOwnerArtistId,
  getShopManagedMemberAgenda,
  inviteShopMember,
  inviteShopMemberByHandle,
  leaveShop,
  listActiveShopMembers,
  listMyShopInvites,
  listMyShopMemberships,
  listShopRoster,
  removeShopMember,
  searchShops,
  setShopMemberMode,
  setShopMemberRole,
  setShopPublished,
  updateShop,
  type ShopSearchParams,
} from "../api/shops";
import type { ShopMemberRole, ShopMembershipMode } from "../types/rows";
import { useInkdClient } from "./context";
import { useCurrentArtistProfile } from "./useArtistContent";

export const shopKeys = {
  all: ["shops"] as const,
  mine: (ownerArtistId: string) => ["shops", "mine", ownerArtistId] as const,
  byHandle: (handle: string) => ["shops", "handle", handle] as const,
  roster: (shopId: string) => ["shops", "roster", shopId] as const,
  activeMembers: (shopId: string) => ["shops", "members", "active", shopId] as const,
  myInvites: (artistId: string) => ["shops", "invites", artistId] as const,
  myMemberships: (artistId: string) => ["shops", "memberships", artistId] as const,
  badges: (artistId: string) => ["shops", "badges", artistId] as const,
  managedAgenda: (shopId: string) => ["shops", "agenda", shopId] as const,
  search: (params: ShopSearchParams) => ["shops", "search", params] as const,
};

// --- reads -----------------------------------------------------------------

/** The shop owned by the currently signed-in artist (or null). */
export function useMyShop() {
  const client = useInkdClient();
  const { data: artist } = useCurrentArtistProfile();
  const ownerArtistId = artist?.id;
  return useQuery({
    queryKey: shopKeys.mine(ownerArtistId ?? ""),
    queryFn: () => getShopByOwnerArtistId(client, ownerArtistId as string),
    enabled: Boolean(ownerArtistId),
  });
}

export function useShopByHandle(handle: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: shopKeys.byHandle(handle ?? ""),
    queryFn: () => getShopByHandle(client, handle as string),
    enabled: Boolean(handle),
  });
}

export function useShopRoster(shopId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: shopKeys.roster(shopId ?? ""),
    queryFn: () => listShopRoster(client, shopId as string),
    enabled: Boolean(shopId),
  });
}

export function useActiveShopMembers(shopId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: shopKeys.activeMembers(shopId ?? ""),
    queryFn: () => listActiveShopMembers(client, shopId as string),
    enabled: Boolean(shopId),
  });
}

/** Pending shop invites for the current artist. */
export function useMyShopInvites() {
  const client = useInkdClient();
  const { data: artist } = useCurrentArtistProfile();
  const artistId = artist?.id;
  return useQuery({
    queryKey: shopKeys.myInvites(artistId ?? ""),
    queryFn: () => listMyShopInvites(client, artistId as string),
    enabled: Boolean(artistId),
  });
}

/** Active shop memberships for the current artist. */
export function useMyShopMemberships() {
  const client = useInkdClient();
  const { data: artist } = useCurrentArtistProfile();
  const artistId = artist?.id;
  return useQuery({
    queryKey: shopKeys.myMemberships(artistId ?? ""),
    queryFn: () => listMyShopMemberships(client, artistId as string),
    enabled: Boolean(artistId),
  });
}

/** The "@ shop" badge(s) for a public artist profile. */
export function useArtistShopBadges(artistProfileId: string | undefined) {
  const client = useInkdClient();
  return useQuery({
    queryKey: shopKeys.badges(artistProfileId ?? ""),
    queryFn: () => getArtistShopBadges(client, artistProfileId as string),
    enabled: Boolean(artistProfileId),
  });
}

/** Managed members' agenda (owner/managers only). */
export function useShopManagedAgenda(
  shopId: string | undefined,
  opts: { from?: string; limit?: number; enabled?: boolean } = {},
) {
  const client = useInkdClient();
  return useQuery({
    queryKey: shopKeys.managedAgenda(shopId ?? ""),
    queryFn: () =>
      getShopManagedMemberAgenda(client, shopId as string, {
        from: opts.from,
        limit: opts.limit,
      }),
    enabled: Boolean(shopId) && (opts.enabled ?? true),
  });
}

export function useShopSearch(params: ShopSearchParams, enabled = true) {
  const client = useInkdClient();
  return useQuery({
    queryKey: shopKeys.search(params),
    queryFn: () => searchShops(client, params),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

// --- mutations -------------------------------------------------------------

/** Create / edit / publish / delete the current artist's shop. */
export function useShopMutations() {
  const client = useInkdClient();
  const qc = useQueryClient();
  const { data: artist } = useCurrentArtistProfile();
  const ownerArtistId = artist?.id;
  const invalidateMine = () => {
    if (ownerArtistId) qc.invalidateQueries({ queryKey: shopKeys.mine(ownerArtistId) });
    qc.invalidateQueries({ queryKey: shopKeys.all });
  };

  return {
    create: useMutation({
      mutationFn: (input: Parameters<typeof createShop>[2]) =>
        createShop(client, ownerArtistId as string, input),
      onSuccess: invalidateMine,
    }),
    update: useMutation({
      mutationFn: (args: { shopId: string; patch: Parameters<typeof updateShop>[2] }) =>
        updateShop(client, args.shopId, args.patch),
      onSuccess: invalidateMine,
    }),
    setPublished: useMutation({
      mutationFn: (args: { shopId: string; isPublished: boolean }) =>
        setShopPublished(client, args.shopId, args.isPublished),
      onSuccess: invalidateMine,
    }),
    remove: useMutation({
      mutationFn: (shopId: string) => deleteShop(client, shopId),
      onSuccess: invalidateMine,
    }),
  };
}

/** Roster management for a shop (owner/managers). */
export function useShopMemberMutations(shopId: string) {
  const client = useInkdClient();
  const qc = useQueryClient();
  const invalidateRoster = () => {
    qc.invalidateQueries({ queryKey: shopKeys.roster(shopId) });
    qc.invalidateQueries({ queryKey: shopKeys.activeMembers(shopId) });
    qc.invalidateQueries({ queryKey: shopKeys.managedAgenda(shopId) });
  };

  return {
    inviteByHandle: useMutation({
      mutationFn: (args: {
        handleOrEmail: string;
        invitedBy?: string | null;
        role?: ShopMemberRole;
        membershipMode?: ShopMembershipMode;
      }) => inviteShopMemberByHandle(client, { shopId, ...args }),
      onSuccess: invalidateRoster,
    }),
    invite: useMutation({
      mutationFn: (args: {
        artistProfileId: string;
        invitedBy?: string | null;
        role?: ShopMemberRole;
        membershipMode?: ShopMembershipMode;
      }) => inviteShopMember(client, { shopId, ...args }),
      onSuccess: invalidateRoster,
    }),
    setRole: useMutation({
      mutationFn: (args: { memberId: string; role: ShopMemberRole }) =>
        setShopMemberRole(client, args.memberId, args.role),
      onSuccess: invalidateRoster,
    }),
    setMode: useMutation({
      mutationFn: (args: { memberId: string; mode: ShopMembershipMode }) =>
        setShopMemberMode(client, args.memberId, args.mode),
      onSuccess: invalidateRoster,
    }),
    remove: useMutation({
      mutationFn: (memberId: string) => removeShopMember(client, memberId),
      onSuccess: invalidateRoster,
    }),
  };
}

/** Invite responses for the current artist (accept / decline / leave). */
export function useShopInviteActions() {
  const client = useInkdClient();
  const qc = useQueryClient();
  const { data: artist } = useCurrentArtistProfile();
  const artistId = artist?.id;
  const invalidate = () => {
    if (artistId) {
      qc.invalidateQueries({ queryKey: shopKeys.myInvites(artistId) });
      qc.invalidateQueries({ queryKey: shopKeys.myMemberships(artistId) });
      qc.invalidateQueries({ queryKey: shopKeys.badges(artistId) });
    }
    qc.invalidateQueries({ queryKey: shopKeys.all });
  };
  return {
    accept: useMutation({
      mutationFn: (memberId: string) => acceptShopInvite(client, memberId),
      onSuccess: invalidate,
    }),
    decline: useMutation({
      mutationFn: (memberId: string) => declineShopInvite(client, memberId),
      onSuccess: invalidate,
    }),
    leave: useMutation({
      mutationFn: (memberId: string) => leaveShop(client, memberId),
      onSuccess: invalidate,
    }),
  };
}
