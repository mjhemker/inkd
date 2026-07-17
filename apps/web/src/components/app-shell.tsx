"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, Icon, Logo, LogoMark, buttonVariants, cx } from "@inkd/ui/web";
import {
  useCurrentProfile,
  useMyShop,
  useAttentionCounts,
  type AttentionCounts,
} from "@inkd/core/hooks";
import {
  bottomNavFor,
  isActivePath,
  primaryNavFor,
  studioNavFor,
  type NavItem,
  type ViewerRole,
} from "@/lib/nav";
import { NotificationBell } from "@/components/notifications/notification-bell";

/** The identity rendered in the sidebar footer. */
export interface ShellIdentity {
  name: string;
  handle: string | null;
  avatarUrl: string | null;
}

/**
 * INKD authenticated app shell.
 *
 * Desktop (md+): fixed left rail — brand, primary nav, an artist "Studio" group,
 * and an account footer. Small screens: a top bar + a 5-slot bottom tab bar.
 * The chrome is near-black and recessive so artwork stays the hero; violet marks
 * only the active surface.
 *
 * Role + identity come from the signed-in profile so nothing leaks another
 * user's data: artists keep Bookings in the Studio group, clients get Bookings
 * in their main nav and no Studio group, and the footer shows the real account.
 * Overrides exist purely for the unauthenticated dev harness.
 */
export function AppShell({
  children,
  currentPath,
  title,
  action,
  identity: identityOverride,
  forceArtistNav,
  attention: attentionOverride,
}: {
  children: ReactNode;
  /** Override active-path detection (used by the /dev/shell preview). */
  currentPath?: string;
  title?: string;
  action?: ReactNode;
  /** Override the footer identity (dev/preview harnesses only). */
  identity?: ShellIdentity;
  /** Force the artist "Studio" nav group on (dev/preview harnesses only). */
  forceArtistNav?: boolean;
  /** Override the nav attention counts (dev/preview harnesses only). */
  attention?: AttentionCounts;
}) {
  const pathname = usePathname();
  const active = currentPath ?? pathname;

  const { data: profile } = useCurrentProfile();
  const isArtist = forceArtistNav ?? Boolean(profile?.is_artist);
  const role: ViewerRole = isArtist ? "artist" : "client";
  const identity: ShellIdentity = identityOverride ?? {
    name: profile?.display_name || profile?.handle || "Your account",
    handle: profile?.handle ?? null,
    avatarUrl: profile?.avatar_url ?? null,
  };

  // Aggregated attention counts, computed once and passed to both nav surfaces
  // so the realtime-backed pending-approvals query is only subscribed once.
  const liveAttention = useAttentionCounts();
  const attention = attentionOverride ?? liveAttention;

  return (
    <div className="min-h-dvh bg-surface-base text-content-primary">
      <Sidebar active={active} role={role} identity={identity} attention={attention} />

      <div className="md:pl-64">
        <TopBar title={title} action={action} />
        <main className="mx-auto w-full max-w-6xl px-5 pb-28 pt-6 md:px-8 md:pb-12">
          {children}
        </main>
      </div>

      <BottomTabs active={active} role={role} attention={attention} />
    </div>
  );
}

/** Ember count pill for nav attention badges (9+ cap). */
function NavBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={cx(
        "grid h-5 min-w-5 place-items-center rounded-full bg-surface-ember px-1.5 font-mono text-[10px] font-bold leading-none text-brand-on-ember",
        className,
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Which attention count, if any, a sidebar destination should badge. */
function sidebarBadge(href: string, a: AttentionCounts): number {
  if (href === "/messages") return a.messages;
  if (href === "/bookings") return a.bookings;
  if (href === "/studio/ai") return a.aiStaff;
  return 0;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/feed"
      className="group inline-flex items-center outline-none"
      aria-label="INKD home"
    >
      {compact ? <LogoMark size={32} /> : <Logo size={32} />}
    </Link>
  );
}

function Sidebar({
  active,
  role,
  identity,
  attention,
}: {
  active: string;
  role: ViewerRole;
  identity: ShellIdentity;
  attention: AttentionCounts;
}) {
  const isArtist = role === "artist";
  // Shop owners get a "Shop" item in the Studio group; the query is disabled for
  // clients/non-artists so nothing leaks to them.
  const { data: shop } = useMyShop();
  const studioItems = studioNavFor({ ownsShop: isArtist && Boolean(shop) });
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border-subtle bg-surface-chrome md:flex">
      <div className="flex h-16 items-center px-5">
        <BrandMark />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-0.5">
          {primaryNavFor(role).map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={active}
              badge={sidebarBadge(item.href, attention)}
            />
          ))}
        </ul>

        {isArtist && (
          <>
            <p className="px-3 pb-2 pt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-content-muted">
              Studio
            </p>
            <ul className="flex flex-col gap-0.5">
              {studioItems.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  active={active}
                  badge={sidebarBadge(item.href, attention)}
                />
              ))}
            </ul>
          </>
        )}
      </nav>

      <div className="border-t border-border-subtle p-3">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-raised"
        >
          <Avatar
            src={identity.avatarUrl ?? undefined}
            name={identity.name}
            size="sm"
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-content-primary">
              {identity.name}
            </span>
            {identity.handle && (
              <span className="truncate font-mono text-xs text-content-muted">
                @{identity.handle}
              </span>
            )}
          </span>
        </Link>
      </div>
    </aside>
  );
}

function SidebarLink({
  item,
  active,
  badge = 0,
}: {
  item: NavItem;
  active: string;
  badge?: number;
}) {
  const isActive = isActivePath(active, item.href);
  return (
    <li>
      <Link
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={cx(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
          isActive
            ? "bg-surface-plate-ink text-content-primary"
            : "text-content-secondary hover:bg-surface-raised hover:text-content-primary",
        )}
      >
        {isActive && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand"
          />
        )}
        <Icon
          name={item.icon}
          size={20}
          className={isActive ? "text-content-accent" : "text-content-muted"}
        />
        <span className="flex-1">{item.label}</span>
        <NavBadge count={badge} />
        {badge > 0 && (
          <span className="sr-only">
            {badge > 9 ? "9 or more" : badge} needing attention
          </span>
        )}
      </Link>
    </li>
  );
}

function TopBar({ title, action }: { title?: string; action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border-subtle bg-surface-chrome/85 px-5 backdrop-blur md:px-8">
      <div className="flex items-center gap-3 md:hidden">
        <BrandMark compact />
      </div>

      {title && (
        <h1 className="hidden font-display text-lg font-bold tracking-tight md:block">
          {title}
        </h1>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Search"
          className="grid h-10 w-10 place-items-center rounded-lg text-content-muted outline-none transition-colors hover:bg-surface-raised hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
        >
          <Icon name="search" size={20} />
        </button>
        <NotificationBell />
        {action ?? (
          <Link
            href="/bookings"
            className={cx(
              buttonVariants({ size: "sm" }),
              "hidden sm:inline-flex",
            )}
          >
            <Icon name="plus" size={16} />
            New booking
          </Link>
        )}
      </div>
    </header>
  );
}

/** Which attention count a bottom tab should badge. The artist "Studio" tab
 * (→ /dashboard) aggregates its whole group; Messages carries its own count. */
function bottomBadge(href: string, a: AttentionCounts): number {
  if (href === "/messages") return a.messages;
  if (href === "/dashboard") return a.studio;
  return 0;
}

function BottomTabs({
  active,
  role,
  attention,
}: {
  active: string;
  role: ViewerRole;
  attention: AttentionCounts;
}) {
  const [pressed, setPressed] = useState<string | null>(null);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface-chrome/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {bottomNavFor(role).map((item) => {
          const isActive = isActivePath(active, item.href);
          const badge = bottomBadge(item.href, attention);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onPointerDown={() => setPressed(item.href)}
                onPointerUp={() => setPressed(null)}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium outline-none transition-transform focus-visible:ring-2 focus-visible:ring-brand",
                  pressed === item.href && "scale-95",
                  isActive ? "text-content-accent" : "text-content-muted",
                )}
              >
                <span className="relative">
                  <Icon name={item.icon} size={22} />
                  {badge > 0 && (
                    <NavBadge count={badge} className="absolute -right-2.5 -top-1.5" />
                  )}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
