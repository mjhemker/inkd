"use client";

/**
 * Offline PREVIEW harness for the new weekly-hours grid editor. Renders the
 * reusable WeeklyHoursGrid in a few states (empty, seeded multi-block week,
 * time-off shading) plus the full BookingEditor it lives inside, against an
 * in-memory fake client. Not linked from product nav.
 */
import { useState } from "react";
import { InkdProvider } from "@inkd/core/hooks";
import { ToastProvider } from "@inkd/ui/web";
import type { WeeklyBlock } from "@inkd/core";

import { WeeklyHoursGrid } from "@/components/availability/WeeklyHoursGrid";
import { BookingEditor } from "@/components/artist";
import { createHoursClient, HOURS_DEMO_ARTIST } from "./hoursClient";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-lg font-bold tracking-tight text-content-primary">
          {title}
        </h2>
        <p className="text-sm text-content-secondary">{description}</p>
      </div>
      {children}
    </section>
  );
}

const SPLIT_WEEK: WeeklyBlock[] = [
  { id: "a", weekday: 2, start: "11:00", end: "14:00" },
  { id: "b", weekday: 2, start: "17:00", end: "21:00" },
  { id: "c", weekday: 3, start: "11:00", end: "19:00" },
  { id: "d", weekday: 4, start: "11:00", end: "19:00" },
  { id: "e", weekday: 5, start: "12:00", end: "20:00" },
  { id: "f", weekday: 6, start: "10:00", end: "16:00" },
];

function GridDemos() {
  const [empty, setEmpty] = useState<WeeklyBlock[]>([]);
  const [week, setWeek] = useState<WeeklyBlock[]>(SPLIT_WEEK);
  const [withOff, setWithOff] = useState<WeeklyBlock[]>(SPLIT_WEEK);

  return (
    <div className="flex flex-col gap-12">
      <Section
        title="Empty grid"
        description="A brand-new week. Every day is closed until the artist drags to add hours."
      >
        <WeeklyHoursGrid blocks={empty} onChange={setEmpty} />
      </Section>

      <Section
        title="Multi-block week (Jayden's split Tuesday)"
        description="Tuesday carries two separate blocks (11:00–14:00 and 17:00–21:00). Drag to move/resize, click a block to edit exact times."
      >
        <WeeklyHoursGrid blocks={week} onChange={setWeek} />
      </Section>

      <Section
        title="Time-off shading"
        description="A planned time-off day is shaded read-only on the grid (hatched, labelled), sitting behind the editable blocks."
      >
        <WeeklyHoursGrid
          blocks={withOff}
          onChange={setWithOff}
          timeOff={[{ weekday: 1, label: "Off Mon" }]}
        />
      </Section>
    </div>
  );
}

export default function HoursPreviewPage() {
  const [client] = useState(() => createHoursClient());

  return (
    <InkdProvider client={client}>
      <ToastProvider>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-14 px-5 py-10">
          <header className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-bold tracking-tight text-content-primary">
              Weekly hours grid
            </h1>
            <p className="text-sm text-content-secondary">
              Calendly-style availability editor. Reusable component shared by
              onboarding step 3 and settings — shown here in isolation and
              inside the full booking editor.
            </p>
          </header>

          <GridDemos />

          <Section
            title="Full booking editor (settings variant)"
            description="The grid embedded in BookingEditor, with time-off, booking window and upload options — against a seeded fake client (Jayden's split week + one upcoming time-off day)."
          >
            <BookingEditor
              artist={HOURS_DEMO_ARTIST as never}
              variant="settings"
            />
          </Section>
        </div>
      </ToastProvider>
    </InkdProvider>
  );
}
