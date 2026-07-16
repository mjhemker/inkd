"use client";

/**
 * Dev-only preview harness for the cancellation waitlist UI (Wave 2). Renders
 * the presentational pieces against mock data — no session/provider needed — so
 * the three screenshot surfaces (client join, client offer w/ countdown, artist
 * view) render standalone. Never linked from product nav.
 */
import { Eyebrow } from "@inkd/ui/web";
import {
  WaitlistOfferCard,
  WaitlistEntryRow,
  type EntryRowData,
} from "@/components/waitlist/shared";
import { WaitlistJoinForm } from "@/components/waitlist/join-form";

const NOW = Date.now();
const iso = (ms: number) => new Date(NOW + ms).toISOString();
const HOUR = 3_600_000;

const clientEntry: EntryRowData = {
  id: "e1",
  artistName: "Jayden Cole",
  serviceName: "Half-day session",
  status: "active",
  earliestDate: "2026-07-20",
  latestDate: "2026-07-31",
  preferredWeekdays: [3, 6],
  preferredTimeStart: "12:00",
  preferredTimeEnd: "17:00",
  note: "Continuing my half-sleeve — flexible on exact time.",
};

const artistEntries: EntryRowData[] = [
  {
    id: "a1",
    clientName: "Riley Vasquez",
    serviceName: "Half-day session",
    status: "offered",
    earliestDate: "2026-07-20",
    latestDate: "2026-07-31",
    preferredWeekdays: [3],
    preferredTimeStart: "12:00",
    preferredTimeEnd: "17:00",
    note: "Wednesday afternoons ideal.",
    priority: 10,
  },
  {
    id: "a2",
    clientName: "Morgan Lee",
    serviceName: "Half-day session",
    status: "active",
    earliestDate: "2026-07-18",
    latestDate: "2026-08-15",
    preferredWeekdays: null,
    preferredTimeStart: null,
    preferredTimeEnd: null,
    note: "Flexible.",
    priority: 0,
  },
];

export default function WaitlistPreviewPage() {
  return (
    <div className="mx-auto max-w-6xl p-8">
      <Eyebrow>Dev preview</Eyebrow>
      <h1 className="mb-8 text-2xl font-semibold text-content">Waitlist — Wave 2</h1>

      <div className="grid gap-8 lg:grid-cols-3">
        <section id="join" className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-content-muted">1 · Client joins</p>
          <WaitlistJoinForm
            artistId="demo"
            artistName="Jayden Cole"
            services={[
              { id: "s1", name: "Consultation" },
              { id: "s2", name: "Half-day session" },
              { id: "s3", name: "Full-day session" },
            ]}
            onSubmit={() => {}}
          />
        </section>

        <section id="offer" className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-content-muted">2 · Client&apos;s waitlist + a live offer</p>
          <WaitlistOfferCard
            offer={{
              id: "o1",
              artistName: "Jayden Cole",
              serviceName: "Half-day session",
              slotStart: iso(6 * HOUR),
              expiresAt: iso(2 * HOUR + 47 * 60_000),
            }}
            onClaim={() => {}}
            onDecline={() => {}}
          />
          <WaitlistEntryRow entry={clientEntry} onCancel={() => {}} />
        </section>

        <section id="artist" className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-content-muted">3 · Artist view</p>
          {artistEntries.map((e) => (
            <WaitlistEntryRow key={e.id} entry={e} showClient />
          ))}
        </section>
      </div>
    </div>
  );
}
