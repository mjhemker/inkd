/**
 * Shops — shared domain vocabulary, the membership STATE MACHINE, and the
 * promotional-vs-managed CAPABILITY MATRIX. Pure and dependency-free so both
 * web and mobile render identical copy, and so the rules can be unit-tested
 * offline (see shops.test.ts) as the mirror of the SQL guard + RLS in
 * migration 20260717080000_shops.sql.
 *
 * A SHOP is an artist account that hosts other artists' accounts. The relation
 * is toggleable:
 *   - promotional — the shop only showcases the artist; the artist keeps full
 *     independence (nothing private is exposed to the shop).
 *   - managed     — the shop has a management layer over the artist: shop
 *     owner/managers may read the artist's bookings/calendar, discovery groups
 *     them under the shop, etc. Managed capabilities are gated behind the
 *     artist ACCEPTING a managed invite.
 */
import type {
  ShopMemberRole,
  ShopMembershipMode,
  ShopMemberStatus,
} from "../types/rows";

// ---------------------------------------------------------------------------
// Vocabulary + labels
// ---------------------------------------------------------------------------
export const SHOP_MEMBER_ROLES: {
  value: ShopMemberRole;
  label: string;
  description: string;
}[] = [
  { value: "owner", label: "Owner", description: "Runs the shop and its roster." },
  { value: "manager", label: "Manager", description: "Manages the roster and shop profile on the owner's behalf." },
  { value: "resident", label: "Resident", description: "A resident artist hosted by the shop." },
  { value: "guest", label: "Guest", description: "A guest or visiting artist." },
];

export const SHOP_MEMBERSHIP_MODES: {
  value: ShopMembershipMode;
  label: string;
  description: string;
}[] = [
  {
    value: "promotional",
    label: "Promotional",
    description: "The shop showcases this artist. They keep full independence — nothing of theirs is shared with the shop.",
  },
  {
    value: "managed",
    label: "Managed",
    description: "The shop manages this artist: owner/managers can see their calendar and bookings, and discovery groups them under the shop.",
  },
];

export const SHOP_MEMBER_STATUSES: {
  value: ShopMemberStatus;
  label: string;
}[] = [
  { value: "invited", label: "Invited" },
  { value: "active", label: "Active" },
  { value: "removed", label: "Removed" },
];

export function shopRoleLabel(role: ShopMemberRole): string {
  return SHOP_MEMBER_ROLES.find((r) => r.value === role)?.label ?? role;
}
export function shopModeLabel(mode: ShopMembershipMode): string {
  return SHOP_MEMBERSHIP_MODES.find((m) => m.value === mode)?.label ?? mode;
}
export function shopStatusLabel(status: ShopMemberStatus): string {
  return SHOP_MEMBER_STATUSES.find((s) => s.value === status)?.label ?? status;
}

// ---------------------------------------------------------------------------
// Membership STATE MACHINE
//
// Actors:
//   - "manager" — the shop owner or an active manager acting on a member row.
//   - "self"    — the member acting on their OWN row.
//   - "other"   — anyone else (never permitted).
//
// Mirrors public.shop_members_guard() exactly so the client cannot attempt a
// transition the database will reject.
// ---------------------------------------------------------------------------
export type ShopMemberActor = "manager" | "self" | "other";

/** Named edges of the state machine — the verbs the UI exposes. */
export type ShopMembershipAction =
  | "invite" // (manager) create -> invited
  | "accept" // (self)    invited -> active
  | "decline" // (self)   invited -> removed
  | "leave" // (self)     active  -> removed
  | "remove"; // (manager) invited|active -> removed

/**
 * Which status transitions are legal for a given actor. `removed` is terminal
 * for `self`; a manager may re-invite (removed -> invited) or reinstate
 * (removed -> active).
 */
export function canTransitionMemberStatus(
  actor: ShopMemberActor,
  from: ShopMemberStatus,
  to: ShopMemberStatus,
): boolean {
  if (from === to) return true; // no-op (e.g. editing role without touching status)
  if (actor === "manager") {
    switch (from) {
      case "invited":
        return to === "active" || to === "removed";
      case "active":
        return to === "removed";
      case "removed":
        return to === "invited" || to === "active";
      default:
        return false;
    }
  }
  if (actor === "self") {
    // accept, decline, leave — nothing else.
    return (
      (from === "invited" && to === "active") ||
      (from === "invited" && to === "removed") ||
      (from === "active" && to === "removed")
    );
  }
  return false;
}

/** The status an action moves a membership to. */
export function statusAfterAction(action: ShopMembershipAction): ShopMemberStatus {
  switch (action) {
    case "invite":
      return "invited";
    case "accept":
      return "active";
    case "decline":
    case "leave":
    case "remove":
      return "removed";
  }
}

/** Whether an actor may perform a named action given the current status. */
export function canPerformMembershipAction(
  actor: ShopMemberActor,
  action: ShopMembershipAction,
  currentStatus: ShopMemberStatus,
): boolean {
  switch (action) {
    case "invite":
      return actor === "manager"; // create-time, no prior status
    case "accept":
      return actor === "self" && currentStatus === "invited";
    case "decline":
      return actor === "self" && currentStatus === "invited";
    case "leave":
      return actor === "self" && currentStatus === "active";
    case "remove":
      return actor === "manager" && (currentStatus === "invited" || currentStatus === "active");
  }
}

/**
 * Only a manager may change a member's role or membership mode. A member acting
 * on their own row can never escalate — this is the client mirror of the guard.
 */
export function canEditMemberRoleOrMode(actor: ShopMemberActor): boolean {
  return actor === "manager";
}

// ---------------------------------------------------------------------------
// CAPABILITY MATRIX — promotional vs managed
// ---------------------------------------------------------------------------
export interface ShopMemberCapabilities {
  /** Appears on the shop's public roster + counts toward the shop. */
  listedInRoster: boolean;
  /** Shows the "@ shop" badge on the artist's public profile. */
  showsShopBadge: boolean;
  /** Grouped under the shop in discovery. */
  groupedInShopDiscovery: boolean;
  /** Shop owner/managers may read this artist's bookings/calendar agenda. */
  shopCanViewAgenda: boolean;
  /** Shop has a management layer (commission context, calendar) over the artist. */
  shopManagesArtist: boolean;
  /** The artist keeps full independence (promotional-only, or not yet active). */
  artistIndependent: boolean;
}

/**
 * The single source of truth for what a shop can do with a member, given their
 * status + mode. Managed capabilities require the member to be ACTIVE (i.e. to
 * have accepted). A promotional member — or any not-yet-active member — exposes
 * nothing private to the shop.
 */
export function shopMemberCapabilities(member: {
  status: ShopMemberStatus;
  membership_mode: ShopMembershipMode;
}): ShopMemberCapabilities {
  const isActive = member.status === "active";
  const isManaged = member.membership_mode === "managed";
  const managed = isActive && isManaged;
  return {
    listedInRoster: isActive,
    showsShopBadge: isActive,
    groupedInShopDiscovery: isActive,
    shopCanViewAgenda: managed,
    shopManagesArtist: managed,
    artistIndependent: !managed,
  };
}

/** Convenience: can the shop read this member's private agenda/calendar? */
export function shopCanViewMemberAgenda(member: {
  status: ShopMemberStatus;
  membership_mode: ShopMembershipMode;
}): boolean {
  return shopMemberCapabilities(member).shopCanViewAgenda;
}
