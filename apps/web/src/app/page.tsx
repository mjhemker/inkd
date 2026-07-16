import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Eyebrow, Icon, type IconName } from "@inkd/ui/web";
import { LinkButton } from "@/components/link-button";

export const metadata: Metadata = {
  title: "INKD — the operating system for tattoo artists",
  description:
    "INKD handles bookings, deposits, waivers and client chat — with AI staff that draft the busywork and show their work. Built for independent tattoo artists in Baltimore and Philadelphia.",
};

interface WallPiece {
  style: string;
  handle: string;
  gradient: string;
  tall?: boolean;
  flash?: boolean;
}

// A gallery wall stand-in: near-black frames with violet-leaning gradients, each
// with a solid museum placard beneath it. Artwork is the hero even before real
// images land. Two pieces carry an ember FLASH stamp.
const wall: WallPiece[] = [
  { style: "Blackwork", handle: "@ravn.ink", gradient: "linear-gradient(150deg,#241733,#0a0a0b 72%)", tall: true, flash: true },
  { style: "Fine line", handle: "@mara.fine", gradient: "linear-gradient(150deg,#15213a,#0a0a0b 72%)" },
  { style: "Neo-trad", handle: "@dez.ttt", gradient: "linear-gradient(150deg,#331327,#0a0a0b 72%)" },
  { style: "Japanese", handle: "@ito.irezumi", gradient: "linear-gradient(150deg,#1c1340,#0a0a0b 72%)", tall: true },
  { style: "Lettering", handle: "@sol.script", gradient: "linear-gradient(150deg,#2a1030,#0a0a0b 72%)", flash: true },
  { style: "Micro-real", handle: "@vee.micro", gradient: "linear-gradient(150deg,#101f33,#0a0a0b 72%)" },
];

const pillars: { icon: IconName; eyebrow: string; title: string; body: string }[] = [
  {
    icon: "calendar",
    eyebrow: "The wedge",
    title: "Artist ops",
    body: "Onboarding, availability, bookings, deposits, waivers and chat — the whole back office in one calm place.",
  },
  {
    icon: "compass",
    eyebrow: "For clients",
    title: "Real discovery",
    body: "A style-tagged feed and a local map with filters that actually work — style, city, price and open books.",
  },
  {
    icon: "sparkles",
    eyebrow: "AI staff",
    title: "Staff that show their work",
    body: "A Front Desk and Booking Manager draft the busywork. You set how much they can do — and see every move.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-surface-base text-content-primary">
      <SiteNav />

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-20 pt-12 md:px-8 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div className="flex flex-col items-start gap-6">
          <Eyebrow>Baltimore · Philadelphia — now onboarding</Eyebrow>
          <h1 className="font-display text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-6xl">
            Run your chair
            <br />
            like a real{" "}
            <span className="text-content-accent">studio</span>.
          </h1>
          <p className="max-w-xl text-lg text-content-secondary">
            INKD handles bookings, deposits, waivers and client chat — with AI
            staff that draft the busywork and always show their work. So you can
            stay on the needle.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <LinkButton href="/auth" size="lg">
              Join as an artist
              <Icon name="arrow-right" size={18} />
            </LinkButton>
            <LinkButton href="/auth" size="lg" variant="secondary">
              I&apos;m here to get tattooed
            </LinkButton>
          </div>
          <p className="pt-2 font-mono text-xs uppercase tracking-[0.18em] text-content-muted">
            Free during pilot · MD + PA ready · Instagram import
          </p>
          {/* The one hand-marked note on the page — the artist's own aside. */}
          <p
            aria-hidden
            className="-mt-1 -rotate-3 font-hand text-3xl leading-tight text-content-ember"
          >
            you make the art — we&apos;ll run the desk
          </p>
        </div>

        <div
          aria-hidden
          className="[column-fill:balance] columns-2 gap-3 [&>*]:mb-3"
        >
          {wall.map((piece) => (
            <figure
              key={piece.style}
              className="group mb-3 break-inside-avoid overflow-hidden rounded-sm border border-border-subtle transition-colors hover:border-border-accent"
            >
              {/* Framed artwork */}
              <div
                className="relative"
                style={{
                  background: piece.gradient,
                  minHeight: piece.tall ? 240 : 156,
                }}
              >
                {piece.flash && (
                  <span className="absolute right-2 top-2 rounded-sm bg-surface-ember px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-on-ember">
                    Flash
                  </span>
                )}
              </div>
              {/* Solid museum placard beneath the piece */}
              <figcaption className="flex items-center justify-between gap-2 border-t border-border-subtle bg-surface-raised px-3 py-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-secondary">
                  {piece.style}
                </span>
                <span className="font-mono text-[11px] text-content-muted">
                  {piece.handle}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Pillars */}
      <section className="border-t border-border-subtle">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8">
          <div className="mb-10 flex flex-col gap-3">
            <Eyebrow>What INKD is</Eyebrow>
            <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
              An ops tool artists love, and a place clients actually find them.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {pillars.map((pillar) => (
              <article
                key={pillar.title}
                className="flex flex-col gap-4 rounded-sm border border-border-subtle bg-surface-raised p-6"
              >
                <span className="grid h-11 w-11 place-items-center rounded-sm bg-brand text-brand-on">
                  <Icon name={pillar.icon} size={22} />
                </span>
                <div className="flex flex-col gap-2">
                  <Eyebrow>{pillar.eyebrow}</Eyebrow>
                  <h3 className="font-display text-xl font-bold tracking-tight text-content-primary">
                    {pillar.title}
                  </h3>
                  <p className="text-sm text-content-secondary">{pillar.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* AI trust band */}
      <section className="border-t border-border-subtle">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8">
          <div
            className="grid items-center gap-8 rounded-sm border border-border-subtle p-8 md:p-12 lg:grid-cols-[1fr_1fr]"
            style={{ background: "linear-gradient(135deg,#180f2c,#141417 68%)" }}
          >
            <div className="flex flex-col gap-4">
              <Eyebrow>AI staff, not AI art</Eyebrow>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Agents that earn your trust.
              </h2>
              <p className="max-w-lg text-content-secondary">
                INKD&apos;s assistants never design tattoos and never invent a
                price or a date. They work from your published rates and
                availability, draft replies for your approval, and hand anything
                sensitive straight to you.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="brand">Draft-only by default</Badge>
                <Badge variant="outline">Every action logged</Badge>
                <Badge variant="outline">You hold the slider</Badge>
              </div>
            </div>
            <ul className="flex flex-col gap-3">
              {[
                { icon: "message-circle" as IconName, text: "Front Desk triages inquiries and drafts grounded replies." },
                { icon: "calendar" as IconName, text: "Booking Manager proposes slots, holds and deposit requests." },
                { icon: "shield" as IconName, text: "Medical, minors and payments always route to you." },
              ].map((row) => (
                <li
                  key={row.text}
                  className="flex items-start gap-3 rounded-sm border border-border-subtle bg-surface-base p-4"
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-surface-overlay text-content-accent">
                    <Icon name={row.icon} size={16} />
                  </span>
                  <span className="text-sm text-content-secondary">{row.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface-base/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 md:px-8">
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
        <nav className="hidden items-center gap-7 text-sm text-content-secondary sm:flex">
          <Link href="/auth" className="transition-colors hover:text-content-primary">
            For artists
          </Link>
          <Link href="/auth" className="transition-colors hover:text-content-primary">
            Discover
          </Link>
          <Link href="/dev/ui" className="transition-colors hover:text-content-primary">
            Design system
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <LinkButton href="/auth" variant="ghost" size="sm">
            Sign in
          </LinkButton>
          <LinkButton href="/auth" size="sm">
            Join INKD
          </LinkButton>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
        <span className="font-display text-lg font-bold tracking-tight">
          INKD
        </span>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-content-muted">
          getinkd.co · Baltimore &amp; Philadelphia pilot · 2026
        </p>
      </div>
    </footer>
  );
}
