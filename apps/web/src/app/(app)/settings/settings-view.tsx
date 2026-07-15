"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Eyebrow,
  Icon,
  Spinner,
  Tabs,
  useToast,
} from "@inkd/ui/web";
import {
  useCurrentProfile,
  useCurrentArtistProfile,
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

const TABS = [
  { value: "profile", label: "Profile" },
  { value: "locations", label: "Locations" },
  { value: "booking", label: "Hours & booking" },
  { value: "services", label: "Services" },
  { value: "waivers", label: "Waivers" },
  { value: "ai", label: "AI staff" },
  { value: "grow", label: "Share & connect" },
  { value: "account", label: "Account" },
];

export function SettingsView() {
  const { toast } = useToast();
  const { data: profile, isLoading: pLoading } = useCurrentProfile();
  const { data: artist, isLoading: aLoading } = useCurrentArtistProfile();
  const searchParams = useSearchParams();
  const initialTab = TABS.some((t) => t.value === searchParams.get("tab"))
    ? (searchParams.get("tab") as string)
    : "profile";
  const [tab, setTab] = useState(initialTab);

  // The instagram-oauth callback redirects here with ?instagram=connected|
  // denied|error — surface the result once, on landing. Deliberately runs
  // only on mount (searchParams/toast omitted from deps) so it never re-fires
  // as the tab state changes afterward.
  useEffect(() => {
    const result = searchParams.get("instagram");
    if (!result) return;
    if (result === "connected") {
      toast({ title: "Instagram connected", variant: "success" });
    } else if (result === "denied") {
      toast({ title: "Instagram connect cancelled" });
    } else if (result === "error") {
      toast({
        title: "Couldn't connect Instagram",
        description: searchParams.get("reason") ?? "Try again.",
        variant: "danger",
      });
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

      {/* `overflow-x-auto` alone makes browsers auto-compute `overflow-y:
          auto` too (CSS overflow §3: "if one axis is a non-visible value and
          the other is visible, visible is set to auto"). The selected tab's
          underline (`Tabs` renders it `-bottom-px`) sits 1px below the
          tablist's border box, so that computed overflow-y saw 1px of
          "content" to scroll — a permanently visible vertical scrollbar with
          nothing meaningful behind it. `overflow-y-hidden` pins that axis so
          only the intended horizontal scroll applies. */}
      <Tabs
        value={tab}
        onValueChange={setTab}
        items={TABS}
        className="overflow-x-auto overflow-y-hidden"
      />

      {/* Content column: wide enough on desktop for forms to breathe and for
          each tab's own two-column field groups (services, locations) to lay
          out side by side, without stretching narrow single-column tabs
          edge-to-edge. Unconstrained below the breakpoint, so mobile is
          unaffected. */}
      <div
        className={
          tab === "grow" ? "max-w-4xl xl:max-w-5xl" : "max-w-3xl xl:max-w-4xl"
        }
      >
        {tab === "profile" && (
          <IdentityEditor profile={profile} artist={artist} variant="settings" />
        )}
        {tab === "locations" && (
          <LocationsEditor artist={artist} variant="settings" />
        )}
        {tab === "booking" && <BookingEditor artist={artist} variant="settings" />}
        {tab === "services" && (
          <ServicesEditor artistId={artist.id} variant="settings" />
        )}
        {tab === "waivers" && <WaiversPanel />}
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
        {tab === "grow" && (
          <div className="flex flex-col gap-10">
            <ShareKit profile={profile} />
            <ConnectedAccountsEditor artist={artist} />
          </div>
        )}
        {tab === "account" && <AccountPanel profileName={profile.display_name} avatarUrl={profile.avatar_url} handle={profile.handle} published={artist.is_published} />}
      </div>
    </div>
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
    </div>
  );
}
