import { AppShell } from "@/components/app-shell";

const pillars = [
  {
    title: "Artist ops",
    body: "Onboarding, availability, bookings, deposits, waivers and chat — the wedge.",
  },
  {
    title: "Client discovery",
    body: "Style-tagged feed, local map and filters, profiles, and a booking flow that works.",
  },
  {
    title: "AI staff",
    body: "Operational agents that show their work — Front Desk, Booking Manager, Studio Manager.",
  },
];

export default function HomePage() {
  return (
    <AppShell>
      <section className="flex flex-col items-start gap-6 py-12">
        <span className="rounded-full border border-border-accent/50 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-content-accent">
          Monorepo online
        </span>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          The operating system for independent{" "}
          <span className="text-content-accent">tattoo artists</span>.
        </h1>
        <p className="max-w-2xl text-lg text-content-secondary">
          Web and mobile, built in tandem on a shared Supabase backend. This is
          the Phase 0 scaffold — brand tokens, shared core, and app shells are in
          place and ready for feature work.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {pillars.map((pillar) => (
          <article
            key={pillar.title}
            className="rounded-xl border border-border-subtle bg-surface-raised p-5"
          >
            <h2 className="mb-2 text-base font-semibold text-content-primary">
              {pillar.title}
            </h2>
            <p className="text-sm text-content-secondary">{pillar.body}</p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
