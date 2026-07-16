/**
 * Data access: shops + shop_members (Wave 2). Every function runs under the
 * caller's RLS session — no service role. The membership state machine is
 * enforced twice: the pure client mirror in ../domain/shops.ts (for UI gating)
 * and, authoritatively, the SQL guard + RLS in migration
 * 20260717080000_shops.sql. This module is the thin, zod-validated bridge.
 *
 * A profile owns at most one shop. A shop's LOCATIONS are the owner artist's
 * studio_locations (a shop IS an artist account); `primary_location_id` points
 * at the headline one.
 */
import { z } from "zod";

import type { InkdSupabaseClient } from "../supabase/client";
import type { Database } from "../types/database";
import type {
  Shop,
  ShopInsert,
  ShopMember,
  ShopMemberRole,
  ShopMembershipMode,
  ShopUpdate,
} from "../types/rows";
import { unwrap, unwrapList, unwrapMaybe } from "./helpers";

// ---------------------------------------------------------------------------
// Shop CRUD
// ---------------------------------------------------------------------------

/** The shop owned by a given artist_profile (or null). */
export async function getShopByOwnerArtistId(
  client: InkdSupabaseClient,
  ownerArtistId: string,
): Promise<Shop | null> {
  return unwrapMaybe(
    await client
      .from("shops")
      .select("*")
      .eq("owner_artist_id", ownerArtistId)
      .maybeSingle(),
  );
}

/** A shop by handle (case-insensitive) — public shop pages. */
export async function getShopByHandle(
  client: InkdSupabaseClient,
  handle: string,
): Promise<Shop | null> {
  return unwrapMaybe(
    await client.from("shops").select("*").ilike("handle", handle).maybeSingle(),
  );
}

/** A shop by id. Null when not found / not visible under RLS. */
export async function getShopById(
  client: InkdSupabaseClient,
  id: string,
): Promise<Shop | null> {
  return unwrapMaybe(
    await client.from("shops").select("*").eq("id", id).maybeSingle(),
  );
}

const shopHandleSchema = z
  .string()
  .trim()
  .min(2)
  .max(30)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i, "Use letters, numbers, dots, dashes.");

const createShopSchema = z.object({
  name: z.string().trim().min(2).max(80),
  handle: shopHandleSchema,
  bio: z.string().max(2000).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  primary_location_id: z.string().uuid().nullable().optional(),
});

/**
 * Create the shop owned by `ownerArtistId` and materialize the owner's own
 * member row (role='owner', status='active'). RLS lets an artist create only a
 * shop they own; the guard trigger permits the owner bootstrap row.
 */
export async function createShop(
  client: InkdSupabaseClient,
  ownerArtistId: string,
  input: z.input<typeof createShopSchema>,
): Promise<Shop> {
  const fields = createShopSchema.parse(input);
  const insert: ShopInsert = { owner_artist_id: ownerArtistId, ...fields };
  const shop = unwrap(
    await client.from("shops").insert(insert).select("*").single(),
  );
  // Owner membership row so the roster is complete + is_shop_manager resolves.
  const { error } = await client.from("shop_members").insert({
    shop_id: shop.id,
    artist_profile_id: ownerArtistId,
    role: "owner",
    membership_mode: "managed",
    status: "active",
    joined_at: new Date().toISOString(),
  });
  if (error) throw error;
  return shop;
}

const updateShopSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    handle: shopHandleSchema,
    bio: z.string().max(2000).nullable(),
    avatar_url: z.string().url().nullable(),
    primary_location_id: z.string().uuid().nullable(),
    is_published: z.boolean(),
  })
  .partial();

export async function updateShop(
  client: InkdSupabaseClient,
  shopId: string,
  patch: z.input<typeof updateShopSchema>,
): Promise<Shop> {
  const fields = updateShopSchema.parse(patch) as ShopUpdate;
  return unwrap(
    await client.from("shops").update(fields).eq("id", shopId).select("*").single(),
  );
}

/** Publish / unpublish the shop's public page + discovery listing. */
export async function setShopPublished(
  client: InkdSupabaseClient,
  shopId: string,
  isPublished: boolean,
): Promise<Shop> {
  return updateShop(client, shopId, { is_published: isPublished });
}

export async function deleteShop(
  client: InkdSupabaseClient,
  shopId: string,
): Promise<void> {
  const { error } = await client.from("shops").delete().eq("id", shopId);
  if (error) throw error;
}

/** Whether a shop handle is free (case-insensitive). */
export async function isShopHandleAvailable(
  client: InkdSupabaseClient,
  handle: string,
): Promise<boolean> {
  const { count, error } = await client
    .from("shops")
    .select("id", { count: "exact", head: true })
    .ilike("handle", handle);
  if (error) throw error;
  return (count ?? 0) === 0;
}

// ---------------------------------------------------------------------------
// Roster — shop_members joined to the artist's profile identity
// ---------------------------------------------------------------------------
export interface ShopRosterMember extends ShopMember {
  artist: {
    id: string;
    profile_id: string;
    classification: Database["public"]["Enums"]["artist_classification"] | null;
    profile: {
      handle: string | null;
      display_name: string | null;
      avatar_url: string | null;
      city: string | null;
      state: Database["public"]["Enums"]["us_state"] | null;
    } | null;
  } | null;
}

const ROSTER_SELECT =
  "*, artist:artist_profiles!shop_members_artist_profile_id_fkey ( id, profile_id, classification, profile:profiles!artist_profiles_profile_id_fkey ( handle, display_name, avatar_url, city, state ) )";

/**
 * The full roster for a manager (all statuses) OR the public roster
 * (active-only) depending on the caller's RLS. Ordered owner → manager →
 * resident → guest, then by name.
 */
export async function listShopRoster(
  client: InkdSupabaseClient,
  shopId: string,
): Promise<ShopRosterMember[]> {
  const rows = unwrapList(
    await client
      .from("shop_members")
      .select(ROSTER_SELECT)
      .eq("shop_id", shopId)
      .order("role", { ascending: true })
      .order("created_at", { ascending: true }),
  ) as unknown as ShopRosterMember[];
  return rows;
}

/** Only active members (the public-facing roster). */
export async function listActiveShopMembers(
  client: InkdSupabaseClient,
  shopId: string,
): Promise<ShopRosterMember[]> {
  const rows = unwrapList(
    await client
      .from("shop_members")
      .select(ROSTER_SELECT)
      .eq("shop_id", shopId)
      .eq("status", "active")
      .order("role", { ascending: true })
      .order("created_at", { ascending: true }),
  ) as unknown as ShopRosterMember[];
  return rows;
}

// ---------------------------------------------------------------------------
// Membership mutations (the state machine)
// ---------------------------------------------------------------------------
const inviteSchema = z.object({
  role: z.enum(["manager", "resident", "guest"]).default("resident"),
  membership_mode: z.enum(["promotional", "managed"]).default("promotional"),
});

/** Invite an artist (by artist_profile id) into the shop as an `invited` row. */
export async function inviteShopMember(
  client: InkdSupabaseClient,
  args: {
    shopId: string;
    artistProfileId: string;
    invitedBy?: string | null;
    role?: ShopMemberRole;
    membershipMode?: ShopMembershipMode;
  },
): Promise<ShopMember> {
  const { role, membership_mode } = inviteSchema.parse({
    role: args.role,
    membership_mode: args.membershipMode,
  });
  return unwrap(
    await client
      .from("shop_members")
      .insert({
        shop_id: args.shopId,
        artist_profile_id: args.artistProfileId,
        role,
        membership_mode,
        status: "invited",
        invited_by: args.invitedBy ?? null,
      })
      .select("*")
      .single(),
  );
}

/**
 * Resolve a handle (or email) to a published/known artist and invite them.
 * Returns { member } on success or { error } describing why the lookup failed,
 * so the UI can show a friendly message instead of a raw Postgrest error.
 */
export async function inviteShopMemberByHandle(
  client: InkdSupabaseClient,
  args: {
    shopId: string;
    handleOrEmail: string;
    invitedBy?: string | null;
    role?: ShopMemberRole;
    membershipMode?: ShopMembershipMode;
  },
): Promise<{ member: ShopMember } | { error: string }> {
  const raw = args.handleOrEmail.trim().replace(/^@/, "");
  if (!raw) return { error: "Enter a handle or email." };
  const isEmail = raw.includes("@");

  const profile = unwrapMaybe(
    isEmail
      ? await client.from("profiles").select("id, is_artist").ilike("email", raw).maybeSingle()
      : await client.from("profiles").select("id, is_artist").ilike("handle", raw).maybeSingle(),
  ) as { id: string; is_artist: boolean } | null;

  if (!profile) return { error: "No INKD account found for that handle or email." };
  if (!profile.is_artist) return { error: "That account isn't an artist account." };

  const artist = unwrapMaybe(
    await client
      .from("artist_profiles")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle(),
  ) as { id: string } | null;
  if (!artist) return { error: "That artist hasn't finished setting up their profile." };

  try {
    const member = await inviteShopMember(client, {
      shopId: args.shopId,
      artistProfileId: artist.id,
      invitedBy: args.invitedBy,
      role: args.role,
      membershipMode: args.membershipMode,
    });
    return { member };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate key|unique/i.test(msg)) {
      return { error: "That artist is already on your roster." };
    }
    return { error: msg };
  }
}

/** Accept an invite (invited → active). Called by the invited artist. */
export async function acceptShopInvite(
  client: InkdSupabaseClient,
  memberId: string,
): Promise<ShopMember> {
  return unwrap(
    await client
      .from("shop_members")
      .update({ status: "active", joined_at: new Date().toISOString() })
      .eq("id", memberId)
      .select("*")
      .single(),
  );
}

/** Decline an invite (invited → removed). Called by the invited artist. */
export async function declineShopInvite(
  client: InkdSupabaseClient,
  memberId: string,
): Promise<ShopMember> {
  return unwrap(
    await client
      .from("shop_members")
      .update({ status: "removed" })
      .eq("id", memberId)
      .select("*")
      .single(),
  );
}

/** Leave a shop (active → removed). Called by the member artist. */
export async function leaveShop(
  client: InkdSupabaseClient,
  memberId: string,
): Promise<ShopMember> {
  return unwrap(
    await client
      .from("shop_members")
      .update({ status: "removed" })
      .eq("id", memberId)
      .select("*")
      .single(),
  );
}

/** Remove a member (manager action → removed). */
export async function removeShopMember(
  client: InkdSupabaseClient,
  memberId: string,
): Promise<ShopMember> {
  return unwrap(
    await client
      .from("shop_members")
      .update({ status: "removed" })
      .eq("id", memberId)
      .select("*")
      .single(),
  );
}

/** Change a member's role (manager only — enforced by the guard). */
export async function setShopMemberRole(
  client: InkdSupabaseClient,
  memberId: string,
  role: ShopMemberRole,
): Promise<ShopMember> {
  z.enum(["manager", "resident", "guest"]).parse(role);
  return unwrap(
    await client
      .from("shop_members")
      .update({ role })
      .eq("id", memberId)
      .select("*")
      .single(),
  );
}

/** Change a member's membership mode (manager only — enforced by the guard). */
export async function setShopMemberMode(
  client: InkdSupabaseClient,
  memberId: string,
  membershipMode: ShopMembershipMode,
): Promise<ShopMember> {
  z.enum(["promotional", "managed"]).parse(membershipMode);
  return unwrap(
    await client
      .from("shop_members")
      .update({ membership_mode: membershipMode })
      .eq("id", memberId)
      .select("*")
      .single(),
  );
}

// ---------------------------------------------------------------------------
// An artist's own memberships / invites (Settings → Shop, badges)
// ---------------------------------------------------------------------------
export interface ShopMembershipWithShop extends ShopMember {
  shop: Pick<Shop, "id" | "name" | "handle" | "avatar_url" | "is_published"> | null;
}

const MEMBERSHIP_SELECT =
  "*, shop:shops!shop_members_shop_id_fkey ( id, name, handle, avatar_url, is_published )";

/** Pending invites for an artist (status='invited'). */
export async function listMyShopInvites(
  client: InkdSupabaseClient,
  artistProfileId: string,
): Promise<ShopMembershipWithShop[]> {
  return unwrapList(
    await client
      .from("shop_members")
      .select(MEMBERSHIP_SELECT)
      .eq("artist_profile_id", artistProfileId)
      .eq("status", "invited")
      .order("invited_at", { ascending: false }),
  ) as unknown as ShopMembershipWithShop[];
}

/** Active memberships for an artist (the shops they belong to). */
export async function listMyShopMemberships(
  client: InkdSupabaseClient,
  artistProfileId: string,
): Promise<ShopMembershipWithShop[]> {
  return unwrapList(
    await client
      .from("shop_members")
      .select(MEMBERSHIP_SELECT)
      .eq("artist_profile_id", artistProfileId)
      .eq("status", "active")
      .order("joined_at", { ascending: false }),
  ) as unknown as ShopMembershipWithShop[];
}

/**
 * The "@ shop" badge(s) for a public artist profile: the PUBLISHED shops the
 * artist is an active member of. Publicly readable under RLS.
 */
export interface ArtistShopBadge {
  shop_id: string;
  handle: string;
  name: string;
  role: ShopMemberRole;
  membership_mode: ShopMembershipMode;
}
export async function getArtistShopBadges(
  client: InkdSupabaseClient,
  artistProfileId: string,
): Promise<ArtistShopBadge[]> {
  const rows = unwrapList(
    await client
      .from("shop_members")
      .select(
        "role, membership_mode, shop:shops!shop_members_shop_id_fkey ( id, handle, name, is_published )",
      )
      .eq("artist_profile_id", artistProfileId)
      .eq("status", "active"),
  ) as unknown as {
    role: ShopMemberRole;
    membership_mode: ShopMembershipMode;
    shop: { id: string; handle: string; name: string; is_published: boolean } | null;
  }[];
  return rows
    .filter((r) => r.shop && r.shop.is_published)
    .map((r) => ({
      shop_id: r.shop!.id,
      handle: r.shop!.handle,
      name: r.shop!.name,
      role: r.role,
      membership_mode: r.membership_mode,
    }));
}

// ---------------------------------------------------------------------------
// Managed member agenda — the "management layer" read (SECURITY DEFINER RPC)
// ---------------------------------------------------------------------------
export type ShopManagedAgendaRow =
  Database["public"]["Functions"]["shop_managed_member_agenda"]["Returns"][number];

/**
 * Bookings/sessions of the shop's MANAGED + ACTIVE members. Returns nothing for
 * promotional members (they exposed nothing) or if the caller doesn't manage
 * the shop. This is the RLS proof point for the management layer.
 */
export async function getShopManagedMemberAgenda(
  client: InkdSupabaseClient,
  shopId: string,
  opts: { from?: string; limit?: number } = {},
): Promise<ShopManagedAgendaRow[]> {
  const { data, error } = await client.rpc("shop_managed_member_agenda", {
    p_shop_id: shopId,
    p_from: opts.from ?? new Date().toISOString(),
    p_limit: opts.limit ?? 100,
  });
  if (error) throw error;
  return (data ?? []) as ShopManagedAgendaRow[];
}

// ---------------------------------------------------------------------------
// Shop discovery
// ---------------------------------------------------------------------------
export type ShopCard =
  Database["public"]["Functions"]["search_shops"]["Returns"][number];

export const shopSearchParamsSchema = z.object({
  state: z.enum(["MD", "PA"]).optional(),
  query: z.string().trim().max(120).optional(),
  limit: z.number().int().positive().max(200).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type ShopSearchParams = z.input<typeof shopSearchParamsSchema>;

/** Discovery: published shops, RLS-respecting (SECURITY INVOKER RPC). */
export async function searchShops(
  client: InkdSupabaseClient,
  params: ShopSearchParams = {},
): Promise<ShopCard[]> {
  const p = shopSearchParamsSchema.parse(params);
  const { data, error } = await client.rpc("search_shops", {
    p_state: p.state ?? undefined,
    p_query: p.query ?? undefined,
    p_limit: p.limit ?? 40,
    p_offset: p.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as ShopCard[];
}
