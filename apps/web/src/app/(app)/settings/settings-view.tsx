"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Eyebrow,
  Icon,
  Input,
  Modal,
  Spinner,
  Tabs,
  cx,
  useToast,
} from "@inkd/ui/web";
import {
  useCurrentProfile,
  useCurrentArtistProfile,
  useDowngradeToClient,
  useInkdClient,
  useMyShop,
} from "@inkd/core/hooks";
import {
  AgentAutonomyEditor,
  BookingEditor,
  ConnectedAccountsEditor,
  IdentityEditor,
  LocationsEditor,
  PlanCard,
  ServicesEditor,
  ShareKit,
} from "@/components/artist";
import { AppearanceControl } from "@/components/appearance-control";
import { NotificationPreferencesPanel } from "@/components/notifications/notification-preferences";
import { ShopSettingsPanel } from "@/components/shop/ShopSettingsPanel";
import { AftercareSettingsCard } from "@/components/aftercare/aftercare-settings-card";

/**
 * Grouped settings tabs (was ~11 flat tabs). Related editors are merged into
 * one tab and shown as clean stacked sections with placard headers:
 *   Profile · Studio (Locations · Hours & booking · Services · Waivers) ·
 *   AI staff · Shop (owners only) · Sharing · Preferences (Notifications ·
 *   Appearance) · Account.
 */
const TAB_DEFS: { value: string; label: string; ownerOnly?: boolean }[] = [
  { value: "profile", label: "Profile" },
  { value: "studio", label: "Studio" },
  { value: "ai", label: "AI staff" },
  { value: "shop", label: "Shop", ownerOnly: true },
  { value: "sharing", label: "Sharing" },
  { value: "preferences", label: "Preferences" },
  { value: "account", label: "Account" },
];

type SettingsSection =
  | "locations"
  | "booking"
  | "services"
  | "waivers"
  | "notifications"
  | "appearance";

/** Section subheaders for the desktop "on this page" ToC. Long, multi-section
 * tabs (Studio, Preferences) get a right-hand sticky index; ids line up with
 * the `settings-section-${id}` anchors rendered by <SettingsSection>. */
const STUDIO_SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "locations", label: "Locations" },
  { id: "booking", label: "Hours & booking" },
  { id: "services", label: "Services" },
  { id: "waivers", label: "Waivers" },
];
const PREFERENCES_SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "notifications", label: "Notifications" },
  { id: "appearance", label: "Appearance" },
];

/**
 * Maps every historical `?tab=` key (and the new tab keys) to the tab it now
 * lives on plus the section to scroll to. Keeps old deep-links landing right:
 * `?tab=notifications` → Preferences › Notifications, `?tab=ai` → AI staff, etc.
 */
const TAB_ROUTE: Record<string, { tab: string; section?: SettingsSection }> = {
  // new keys
  profile: { tab: "profile" },
  studio: { tab: "studio" },
  ai: { tab: "ai" },
  shop: { tab: "shop" },
  sharing: { tab: "sharing" },
  preferences: { tab: "preferences" },
  account: { tab: "account" },
  // legacy keys → grouped tab + section
  locations: { tab: "studio", section: "locations" },
  booking: { tab: "studio", section: "booking" },
  services: { tab: "studio", section: "services" },
  waivers: { tab: "studio", section: "waivers" },
  grow: { tab: "sharing" },
  notifications: { tab: "preferences", section: "notifications" },
  appearance: { tab: "preferences", section: "appearance" },
};

/** Friendly per-reason copy for the Instagram OAuth callback error return. */
function instagramReasonMessage(reason: string | null): string {
  switch (reason) {
    case "invalid_state":
      return "That connect link expired. Try connecting again.";
    case "token_exchange_failed":
    case "long_token_failed":
      return "Instagram couldn't complete the connection. Try again.";
    case "profile_fetch_failed":
      return "We couldn't read your Instagram profile. Make sure it's a Business or Creator account.";
    case "not_configured":
      return "Instagram import isn't available yet.";
    case "missing_params":
    case "db_error":
    case "server_error":
    default:
      return "Something went wrong connecting Instagram. Try again.";
  }
}

export function SettingsView() {
  const { toast } = useToast();
  const { data: profile, isLoading: pLoading } = useCurrentProfile();
  const { data: artist, isLoading: aLoading } = useCurrentArtistProfile();
  const { data: shop } = useMyShop();
  const searchParams = useSearchParams();

  const route = TAB_ROUTE[searchParams.get("tab") ?? ""] ?? { tab: "profile" };
  const [tab, setTab] = useState(route.tab);
  // Section to scroll to on landing (from a legacy deep-link), consumed once.
  const initialSection = route.section;

  // Shop tab is owners-only; hide it for everyone else.
  const tabs = TAB_DEFS.filter((t) => !t.ownerOnly || Boolean(shop));

  // Studio + Preferences are long, multi-section tabs — they get the desktop
  // right-hand "on this page" ToC alongside the content column.
  const withToc = tab === "studio" || tab === "preferences";

  // On landing via a legacy section deep-link, scroll that section into view
  // once the grouped tab has rendered its stacked sections.
  useEffect(() => {
    if (!initialSection) return;
    const el = document.getElementById(`settings-section-${initialSection}`);
    if (el) el.scrollIntoView({ block: "start", behavior: "auto" });
    // Run once on mount — the deep-link only steers the initial landing
    // (initialSection omitted from deps intentionally).
  }, []);

  // The instagram-oauth callback redirects here with ?instagram=connected or
  // ?instagram=error&reason=<code>. This drives a ONE-TIME toast only — the
  // Instagram section always re-derives its real state from `instagram-status`,
  // never from this param. We strip the param afterward so a refresh doesn't
  // re-fire it. Runs only on mount (deps intentionally empty).
  useEffect(() => {
    const result = searchParams.get("instagram");
    if (!result) return;
    if (result === "connected") {
      toast({ title: "Instagram connected", variant: "success" });
    } else {
      const reason = searchParams.get("reason");
      if (reason === "access_denied") {
        toast({ title: "Connection cancelled" });
      } else {
        toast({
          title: "Couldn't connect Instagram",
          description: instagramReasonMessage(reason),
          variant: "danger",
        });
      }
    }
    // Strip the one-time param from the URL so it can't re-fire on refresh.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("instagram");
      url.searchParams.delete("reason");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);

  if (pLoading || aLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner size={26} />
      </div>
    );
  }

  if (!profile) {
    return (
      <p className="text-content-secondary">
        We couldn&apos;t load your account. Try refreshing.
      </p>
    );
  }

  if (!artist) {
    return (
      <Card padding="lg" className="flex flex-col items-start gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-surface-overlay text-content-accent">
          <Icon name="sparkles" size={22} />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-xl font-bold tracking-tight">
            Set up your artist profile
          </h2>
          <p className="max-w-md text-content-secondary">
            Finish onboarding to manage your studio, hours, services and AI staff
            here.
          </p>
        </div>
        <Link href="/onboarding">
          <Button>
            Start setup
            <Icon name="arrow-right" size={16} />
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Eyebrow>Settings</Eyebrow>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Studio settings
        </h1>
        <p className="text-content-secondary">
          Manage everything clients see and how your books run.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={setTab}
        items={tabs}
        className="max-w-full"
      />

      {/* Content column: wide enough on desktop for forms to breathe and for
          each tab's own two-column field groups (services, locations) to lay
          out side by side, without stretching narrow single-column tabs
          edge-to-edge. Long multi-section tabs (Studio, Preferences) pair the
          content with a right-hand sticky "on this page" ToC on lg+ screens.
          Unconstrained below the breakpoint, so mobile is unaffected. */}
      <div
        className={cx(
          withToc
            ? "lg:flex lg:items-start lg:gap-10"
            : tab === "sharing"
              ? "max-w-4xl xl:max-w-5xl"
              : "max-w-3xl xl:max-w-4xl",
        )}
      >
        <div className={withToc ? "min-w-0 flex-1 lg:max-w-3xl xl:max-w-4xl" : undefined}>
        {tab === "profile" && (
          <IdentityEditor profile={profile} artist={artist} variant="settings" />
        )}

        {tab === "studio" && (
          <div className="flex flex-col gap-10">
            <SettingsSection
              section="locations"
              eyebrow="Studio"
              title="Locations"
              description="Where you tattoo — studios, private suites, and travel options."
            >
              <LocationsEditor artist={artist} variant="settings" />
            </SettingsSection>
            <SettingsSection
              section="booking"
              eyebrow="Studio"
              title="Hours & booking"
              description="Business days, vacation blocks, booking window, and aftercare."
            >
              <div className="flex flex-col gap-6">
                <BookingEditor artist={artist} variant="settings" />
                <AftercareSettingsCard artist={artist} />
              </div>
            </SettingsSection>
            <SettingsSection
              section="services"
              eyebrow="Studio"
              title="Services"
              description="What clients can book, with rates, durations, and add-ons."
            >
              <ServicesEditor artistId={artist.id} variant="settings" />
            </SettingsSection>
            <SettingsSection
              section="waivers"
              eyebrow="Studio"
              title="Waivers"
              description="MD/PA consent forms and signed-waiver records."
            >
              <WaiversPanel />
            </SettingsSection>
          </div>
        )}

        {tab === "ai" && (
          <div className="flex flex-col gap-5">
            <Link
              href="/studio/ai"
              className="flex items-center justify-between gap-3 rounded-sm border border-border-subtle bg-surface-raised px-4 py-3 transition-colors hover:border-border-accent"
            >
              <span className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-sm bg-surface-ember text-brand-on-ember">
                  <Icon name="sparkles" size={17} />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-content-primary">
                    Your AI staff area
                  </span>
                  <span className="text-xs text-content-muted">
                    Approvals, activity ledger, and playbook
                  </span>
                </span>
              </span>
              <Icon name="arrow-right" size={16} className="text-content-muted" />
            </Link>
            <AgentAutonomyEditor artist={artist} variant="settings" />
          </div>
        )}

        {tab === "shop" && <ShopSettingsPanel />}

        {tab === "sharing" && (
          <div className="flex flex-col gap-10">
            <ShareKit profile={profile} />
            <ConnectedAccountsEditor artist={artist} />
          </div>
        )}

        {tab === "preferences" && (
          <div className="flex flex-col gap-10">
            <SettingsSection
              section="notifications"
              eyebrow="Preferences"
              title="Notifications"
              description="Choose what INKD tells you about, and where."
            >
              <NotificationPreferencesPanel />
            </SettingsSection>
            <SettingsSection
              section="appearance"
              eyebrow="Preferences"
              title="Appearance"
              description="How INKD looks on this device."
            >
              <AppearancePanel />
            </SettingsSection>
          </div>
        )}

        {tab === "account" && (
          <AccountPanel
            profileName={profile.display_name}
            avatarUrl={profile.avatar_url}
            handle={profile.handle}
            published={artist.is_published}
          />
        )}
        </div>

        {tab === "studio" && <SectionToc sections={STUDIO_SECTIONS} />}
        {tab === "preferences" && <SectionToc sections={PREFERENCES_SECTIONS} />}
      </div>
    </div>
  );
}

/** Desktop-only sticky "on this page" index for a long settings tab. Highlights
 * the section currently in view (IntersectionObserver) and smooth-scrolls to a
 * section on click; the anchors' `scroll-mt-24` clears the sticky header. Hidden
 * below lg. Mono placard styling to match the section eyebrows. */
function SectionToc({
  sections,
}: {
  sections: { id: SettingsSection; label: string }[];
}) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(`settings-section-${s.id}`))
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id.replace("settings-section-", ""));
        }
      },
      // Top margin clears the sticky header; the tall bottom margin means a
      // section counts as "current" once it reaches the upper third.
      { rootMargin: "-96px 0px -55% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    // `self-stretch` is load-bearing: the parent flex row uses `items-start`, so
    // without it this aside collapses to the ToC's own height and the inner
    // `sticky` element has zero travel room — it silently scrolls away instead of
    // sticking. Stretching the aside to the (tall) content column's height gives
    // the sticky index room to pin. (The page scroll container is the window; no
    // ancestor sets overflow, so sticky's containing block is fine.)
    <aside className="hidden w-44 shrink-0 self-stretch lg:block">
      <div className="sticky top-24 flex flex-col gap-2">
        <span className="px-3 font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
          On this page
        </span>
        <nav className="flex flex-col gap-0.5">
          {sections.map((s) => {
            const isActive = activeId === s.id;
            return (
              <a
                key={s.id}
                href={`#settings-section-${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(`settings-section-${s.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                aria-current={isActive ? "location" : undefined}
                className={cx(
                  "border-l-2 px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand",
                  isActive
                    ? "border-brand font-medium text-content-primary"
                    : "border-border-subtle text-content-muted hover:text-content-secondary",
                )}
              >
                {s.label}
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

/** Placard section header + its editor, used inside merged settings tabs. The
 * id lets legacy `?tab=` deep-links scroll straight to the right section. */
function SettingsSection({
  section,
  eyebrow,
  title,
  description,
  children,
}: {
  section: SettingsSection;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={`settings-section-${section}`}
      className="flex scroll-mt-24 flex-col gap-4"
    >
      <div className="flex flex-col gap-1 border-l-2 border-brand bg-surface-raised px-4 py-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
          {eyebrow}
        </span>
        <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm text-content-secondary">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function WaiversPanel() {
  return (
    <Card padding="lg" className="flex flex-col items-start gap-4">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-surface-overlay text-content-accent">
        <Icon name="shield" size={22} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-xl font-bold tracking-tight">
          Consent &amp; waivers
        </h2>
        <p className="max-w-md text-content-secondary">
          Manage your MD/PA consent forms, edit template content, and review
          signed waivers from clients.
        </p>
      </div>
      <Link href="/settings/waivers">
        <Button>
          Manage waivers
          <Icon name="arrow-right" size={16} />
        </Button>
      </Link>
    </Card>
  );
}

function AppearancePanel() {
  return (
    <Card padding="lg" className="flex flex-col items-start gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-xl font-bold tracking-tight">
          Appearance
        </h2>
        <p className="max-w-md text-content-secondary">
          Choose how INKD looks on this device. Dark is the gallery default;
          Light is a warm paper wall for daytime studios. System follows your
          device.
        </p>
      </div>
      <AppearanceControl />
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-content-muted">
        Saved on this device
      </p>
    </Card>
  );
}

function AccountPanel({
  profileName,
  avatarUrl,
  handle,
  published,
}: {
  profileName: string | null;
  avatarUrl: string | null;
  handle: string | null;
  published: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card padding="md" className="flex items-center gap-4">
        <Avatar src={avatarUrl ?? undefined} name={profileName ?? "You"} size="lg" />
        <div className="flex flex-1 flex-col">
          <span className="text-base font-semibold text-content-primary">
            {profileName ?? "Your account"}
          </span>
          <span className="font-mono text-sm text-content-muted">
            @{handle ?? "—"}
          </span>
        </div>
        <Badge variant={published ? "success" : "neutral"}>
          {published ? "Published" : "Draft"}
        </Badge>
      </Card>

      <PlanCard />

      <div className="flex flex-col gap-3 rounded-xl border border-border-subtle p-5">
        <span className="text-sm font-medium text-content-primary">Session</span>
        <p className="text-sm text-content-secondary">
          Sign out on this device. You can always sign back in with your email.
        </p>
        <form action="/auth/sign-out" method="post" className="pt-1">
          <Button type="submit" variant="outline">
            <Icon name="arrow-right" size={16} />
            Sign out
          </Button>
        </form>
      </div>

      <SwitchToClientCard />

      <DangerZoneCard />
    </div>
  );
}

/** Artist → client downgrade (there is no self-serve client → artist path).
 * Exported so the /dev/account-preview harness can render it without a session. */
export function SwitchToClientCard() {
  const { toast } = useToast();
  const router = useRouter();
  const downgrade = useDowngradeToClient();
  const [open, setOpen] = useState(false);

  async function handleDowngrade() {
    try {
      await downgrade.mutateAsync();
      setOpen(false);
      toast({ title: "Switched to a client account", variant: "success" });
      router.push("/feed");
      router.refresh();
    } catch (err) {
      toast({
        title: "Couldn't switch account",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-subtle p-5">
      <span className="text-sm font-medium text-content-primary">
        Switch to a client account
      </span>
      <p className="text-sm text-content-secondary">
        Step back from being an artist and use INKD to get tattooed. Your studio
        stays intact — nothing is deleted.
      </p>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Switch to client account
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Switch to a client account?"
        description="Here's exactly what happens:"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={downgrade.isPending}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleDowngrade()}
              loading={downgrade.isPending}
            >
              Switch to client
            </Button>
          </div>
        }
      >
        <ul className="flex flex-col gap-2 text-sm text-content-secondary">
          <li className="flex items-start gap-2">
            <Icon name="check" size={15} className="mt-0.5 text-content-accent" />
            Your public profile is unpublished and no longer discoverable.
          </li>
          <li className="flex items-start gap-2">
            <Icon name="check" size={15} className="mt-0.5 text-content-accent" />
            Your bookings, portfolio and signed waivers are kept but frozen —
            never deleted.
          </li>
          <li className="flex items-start gap-2">
            <Icon name="check" size={15} className="mt-0.5 text-content-accent" />
            Your navigation switches to the client experience.
          </li>
          <li className="flex items-start gap-2">
            <Icon name="shield" size={15} className="mt-0.5 text-content-muted" />
            Becoming an artist again is invite/setup-based during the pilot —
            reach out and we&apos;ll switch you back.
          </li>
        </ul>
      </Modal>
    </div>
  );
}

/** Danger zone: permanent account deletion behind a typed confirmation.
 * Exported so the /dev/account-preview harness can render it without a session. */
export function DangerZoneCard() {
  const { toast } = useToast();
  const router = useRouter();
  const supabase = useInkdClient();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        method: "POST",
      });
      if (error) throw error;
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      setDeleting(false);
      toast({
        title: "Couldn't delete account",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-danger-500/40 bg-danger-500/5 p-5">
      <span className="text-sm font-medium text-danger-500">Danger zone</span>
      <p className="text-sm text-content-secondary">
        Permanently delete your INKD account and all of your data. This cannot be
        undone.
      </p>
      <Button
        variant="outline"
        className="border-danger-500/50 text-danger-500 hover:bg-danger-500/10"
        onClick={() => {
          setConfirmText("");
          setOpen(true);
        }}
      >
        <Icon name="alert-triangle" size={16} />
        Delete account
      </Button>

      <Modal
        open={open}
        onClose={() => (deleting ? undefined : setOpen(false))}
        title="Delete your account?"
        description="This permanently removes your account, profile, and studio data. This cannot be undone."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="outline"
              className="border-danger-500/50 text-danger-500 hover:bg-danger-500/10"
              disabled={confirmText !== "DELETE"}
              loading={deleting}
              onClick={() => void handleDelete()}
            >
              Delete account
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="delete-confirm" className="text-sm text-content-secondary">
            Type <span className="font-mono font-semibold text-content-primary">DELETE</span> to confirm.
          </label>
          <Input
            id="delete-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
        </div>
      </Modal>
    </div>
  );
}
