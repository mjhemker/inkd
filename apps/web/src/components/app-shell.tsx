"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, Icon, buttonVariants, cx } from "@inkd/ui/web";
import {
  artistNav,
  isActivePath,
  primaryNav,
  type NavItem,
} from "@/lib/nav";

/**
 * INKD authenticated app shell.
 *
 * Desktop (md+): fixed left rail — brand, primary nav, an artist "Studio" group,
 * and an account footer. Small screens: a top bar + a 5-slot bottom tab bar.
 * The chrome is near-black and recessive so artwork stays the hero; violet marks
 * only the active surface.
 */
export function AppShell({
  children,
  currentPath,
  title,
  action,
}: {
  children: ReactNode;
  /** Override active-path detection (used by the /dev/shell preview). */
  currentPath?: string;
  title?: string;
  action?: ReactNode;
}) {
  const pathname = usePathname();
  const active = currentPath ?? pathname;

  return (
    <div className="min-h-dvh bg-surface-base text-content-primary">
      <Sidebar active={active} />

      <div className="md:pl-64">
        <TopBar title={title} action={action} />
        <main className="mx-auto w-full max-w-6xl px-5 pb-28 pt-6 md:px-8 md:pb-12">
          {children}
        </main>
      </div>

      <BottomTabs active={active} />
    </div>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/feed"
      className="group inline-flex items-center gap-2.5 outline-none"
      aria-label="INKD home"
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-on">
        <span className="font-display text-lg font-extrabold leading-none">
          I
        </span>
      </span>
      {!compact && (
        <span className="font-display text-xl font-bold tracking-tight text-content-primary">
          INKD
        </span>
      )}
    </Link>
  );
}

function Sidebar({ active }: { active: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border-subtle bg-surface-base md:flex">
      <div className="flex h-16 items-center px-5">
        <BrandMark />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-0.5">
          {primaryNav.map((item) => (
            <SidebarLink key={item.href} item={item} active={active} />
          ))}
        </ul>

        <p className="px-3 pb-2 pt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-content-muted">
          Studio
        </p>
        <ul className="flex flex-col gap-0.5">
          {artistNav.map((item) => (
            <SidebarLink key={item.href} item={item} active={active} />
          ))}
        </ul>
      </nav>

      <div className="border-t border-border-subtle p-3">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-raised"
        >
          <Avatar name="Jayden Cole" size="sm" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-content-primary">
              Jayden Cole
            </span>
            <span className="truncate font-mono text-xs text-content-muted">
              @jayden.ink
            </span>
          </span>
        </Link>
      </div>
    </aside>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: string }) {
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
        {item.label}
      </Link>
    </li>
  );
}

function TopBar({ title, action }: { title?: string; action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border-subtle bg-surface-base/85 px-5 backdrop-blur md:px-8">
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
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-10 w-10 place-items-center rounded-lg text-content-muted outline-none transition-colors hover:bg-surface-raised hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
        >
          <Icon name="bell" size={20} />
          <span
            aria-hidden
            className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand"
          />
        </button>
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

function BottomTabs({ active }: { active: string }) {
  const [pressed, setPressed] = useState<string | null>(null);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface-base/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {primaryNav.map((item) => {
          const isActive = isActivePath(active, item.href);
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
                <Icon name={item.icon} size={22} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
