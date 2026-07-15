import type { Metadata } from "next";
import Link from "next/link";
import {
  Eyebrow,
  Icon,
  ProgressBar,
  Stepper,
} from "@inkd/ui/web";
import { LinkButton } from "@/components/link-button";

export const metadata: Metadata = { title: "Get set up" };

const steps = [
  { label: "Identity", description: "Name, handle, portfolio" },
  { label: "Location", description: "Studio & travel" },
  { label: "Booking", description: "Hours & window" },
  { label: "Services", description: "Rates & deposits" },
  { label: "Verify", description: "ID & payouts" },
];

export default function OnboardingPage() {
  return (
    <div className="min-h-dvh bg-surface-base text-content-primary">
      <header className="flex h-16 items-center justify-between border-b border-border-subtle px-5 md:px-8">
        <span className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-on">
            <span className="font-display text-lg font-extrabold leading-none">
              I
            </span>
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            INKD
          </span>
        </span>
        <Link
          href="/feed"
          className="text-sm font-medium text-content-muted outline-none transition-colors hover:text-content-primary focus-visible:text-content-primary"
        >
          Save &amp; exit
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-5 py-10 md:py-16">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Eyebrow>Step 1 of 5</Eyebrow>
            <span className="font-mono text-xs text-content-muted">20%</span>
          </div>
          <ProgressBar value={20} />
          <Stepper steps={steps} current={0} className="pt-2" />
        </div>

        <div className="flex flex-col items-start gap-5 rounded-2xl border border-border-subtle bg-surface-raised p-8">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-surface-overlay text-content-accent">
            <Icon name="user" size={24} />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Let&apos;s set up your chair
            </h1>
            <p className="max-w-lg text-content-secondary">
              We&apos;ll walk through your identity, studio, booking rules,
              services and verification — then hand you the keys to your
              dashboard. The full guided flow is being built on this screen.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <LinkButton href="/dashboard" size="lg">
              Continue
              <Icon name="arrow-right" size={18} />
            </LinkButton>
            <LinkButton href="/feed" size="lg" variant="ghost">
              Do this later
            </LinkButton>
          </div>
        </div>
      </main>
    </div>
  );
}
