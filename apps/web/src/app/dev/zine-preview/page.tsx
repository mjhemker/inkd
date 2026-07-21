"use client";

/**
 * /dev/zine-preview — foundation harness for the "Zine System" hierarchy pass.
 * Shows the hero button, hero card, ink-inverted tabs, and the stamp/chip/
 * status vocabulary. Flip the Appearance control to review Daylight (ink hero)
 * vs Night (ember hero). Foundation only — no real screens are restyled here.
 * See docs/zine-hierarchy.md.
 */
import { useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPlacard,
  CardTitle,
  Chip,
  Icon,
  Eyebrow,
  StatusDot,
  Tabs,
} from "@inkd/ui/web";
import { AppearanceControl } from "@/components/appearance-control";

export default function ZinePreviewPage() {
  const [tab, setTab] = useState("inbox");

  return (
    <div className="min-h-dvh bg-surface-base text-content-primary">
      <header className="border-b border-border-subtle">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <Eyebrow>INKD zine system · foundation</Eyebrow>
            <AppearanceControl />
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            One hero per screen
          </h1>
          <p className="max-w-2xl text-content-secondary">
            The offset shadow appears exactly once per screen — on the thing you
            should click.{" "}
            <span className="text-content-primary">Ink in daylight, ember at night.</span>{" "}
            Everything else is a flat hairline card. Flip the toggle to see both.
          </p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-6 py-12">
        {/* HERO BUTTON */}
        <Section
          title="Hero button"
          note="Primary violet plate + the one offset shadow. Press it — it translates into the shadow."
        >
          <Row>
            <Button hero leadingIcon={<Icon name="check" size={18} />}>
              Approve &amp; send
            </Button>
            <Button hero>Request a booking</Button>
          </Row>
          <p className="text-sm text-content-muted">
            For contrast, the ordinary buttons below carry NO offset — only the
            hero does.
          </p>
          <Row>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </Row>
        </Section>

        {/* HERO CARD vs flat cards */}
        <Section
          title="Hero card"
          note="When the CARD is the screen's action (needs-review booking). Flat surface + the one offset. Sibling cards stay flat hairline."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Card hero padding="none">
              <CardPlacard meta={<span className="text-danger-600">NEEDS REVIEW</span>}>
                Booking request
              </CardPlacard>
              <div className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <CardTitle>Full sleeve consult — Mara F.</CardTitle>
                    <CardDescription>Blackwork · 3–4 sessions</CardDescription>
                  </div>
                  <Badge variant="ember">$300 deposit</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="date">Thu, Aug 14</Badge>
                  <Badge variant="stamp">Awaiting you</Badge>
                </div>
                <CardFooter className="pt-2">
                  <Button size="sm">Review</Button>
                  <Button size="sm" variant="ghost">
                    Decline
                  </Button>
                </CardFooter>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Scheduled session</CardTitle>
                <CardDescription>A flat hairline card — no offset.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="date">Fri, Aug 22</Badge>
                  <Badge variant="brand">Scheduled</Badge>
                  <Badge variant="success">Healed</Badge>
                </div>
                <p className="text-sm text-content-secondary">
                  Balance due at session:{" "}
                  <span className="text-money">$720.00</span>
                </p>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* TABS */}
        <Section
          title="Segmented tabs"
          note="Active tab inverts to solid ink (black in daylight, off-white at night). Red count pill preserved."
        >
          <Tabs
            value={tab}
            onValueChange={setTab}
            items={[
              {
                value: "inbox",
                label: "Inbox",
                icon: <CountPill n={3} />,
              },
              { value: "scheduled", label: "Scheduled" },
              { value: "history", label: "History" },
            ]}
          />
          <p className="pt-1 text-sm text-content-muted">
            Active: <span className="font-mono text-content-accent">{tab}</span>
          </p>
        </Section>

        {/* STAMPS / CHIPS / STATUS */}
        <Section
          title="Stamps, chips & status"
          note="Red only on counts & medical. Money in ember. Dates soft gray. Staff status is a dot."
        >
          <Labeled label="Red stamps (awaiting / medical only)">
            <Badge variant="stamp">Awaiting you</Badge>
            <Badge variant="stamp">Medical — yours to handle</Badge>
          </Labeled>
          <Labeled label="Status chips">
            <Badge variant="ember">Deposit due</Badge>
            <Badge variant="brand">Scheduled</Badge>
            <Badge variant="success">Healed</Badge>
          </Labeled>
          <Labeled label="Date chips (soft gray)">
            <Badge variant="date">Thu, Aug 14</Badge>
            <Badge variant="date">2:30 PM</Badge>
          </Labeled>
          <Labeled label="Money (ember, mono, tabular)">
            <span className="text-money text-lg">$1,200.00</span>
            <span className="text-money text-lg">$300.00</span>
          </Labeled>
          <Labeled label="Staff status">
            <StatusDot on label="Front desk — On" />
            <StatusDot label="Booking agent — Off" />
          </Labeled>
          <Labeled label="Filter chips (unchanged)">
            <Chip selected>Blackwork</Chip>
            <Chip>Fine line</Chip>
            <Chip leadingIcon={<Icon name="map-pin" size={14} />}>Baltimore</Chip>
          </Labeled>
        </Section>
      </div>
    </div>
  );
}

/** A red count pill for a tab's icon slot (count = one of red's allowed uses). */
function CountPill({ n }: { n: number }) {
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[11px] font-bold text-neutral-50">
      {n}
    </span>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
          <span className="h-px flex-1 bg-border-subtle" />
        </div>
        {note && <p className="text-sm text-content-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-content-muted">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
