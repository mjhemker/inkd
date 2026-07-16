"use client";

import { useEffect, useState } from "react";
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
  useToast,
} from "@inkd/ui/web";
import {
  useCurrentProfile,
  useCurrentArtistProfile,
  useDowngradeToClient,
  useInkdClient,
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

const TABS = [
  { value: "profile", label: "Profile" },
  { value: "locations", label: "Locations" },
  { value: "booking", label: "Hours & booking" },
  { value: "services", label: "Services" },
  { value: "ai", label: "AI staff" },
  { value: "waivers", label: "Waivers" },
  { value: "grow", label: "Share & connect" },
  { value: "notifications", label: "Notifications" },
  { value: "appearance", label: "Appearance" },
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
        {tab === "notifications" && <NotificationPreferencesPanel />}
        {tab === "appearance" && <AppearancePanel />}
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
