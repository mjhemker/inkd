"use client";

import { useState, type ReactNode } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPlacard,
  CardTitle,
  Checkbox,
  Chip,
  DateField,
  Divider,
  EmptyState,
  Eyebrow,
  FormField,
  Icon,
  Input,
  Modal,
  ProgressBar,
  RadioGroup,
  Select,
  Sheet,
  Skeleton,
  Slider,
  Spinner,
  Stepper,
  Tabs,
  TextArea,
  TimeField,
  Toggle,
  ToastProvider,
  useToast,
  type IconName,
} from "@inkd/ui/web";
import { AppearanceControl } from "@/components/appearance-control";

const allIcons: IconName[] = [
  "home", "compass", "calendar", "message-circle", "user", "layout-grid",
  "settings", "search", "bell", "plus", "check", "x", "chevron-down",
  "chevron-right", "chevron-left", "arrow-right", "map-pin", "star", "image",
  "sparkles", "menu", "credit-card", "clock", "shield", "trending-up",
  "alert-triangle", "sun", "moon", "monitor",
];

const styleTags = ["Blackwork", "Fine line", "Traditional", "Japanese", "Lettering"];

export default function DevUiPage() {
  return (
    <ToastProvider>
      <Gallery />
    </ToastProvider>
  );
}

function Gallery() {
  const { toast } = useToast();
  const [chips, setChips] = useState<string[]>(["Blackwork"]);
  const [check, setCheck] = useState(true);
  const [toggle, setToggle] = useState(true);
  const [radio, setRadio] = useState("draft");
  const [slider, setSlider] = useState(2);
  const [tab, setTab] = useState("overview");
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);

  return (
    <div className="min-h-dvh bg-surface-base text-content-primary">
      <header className="border-b border-border-subtle">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <Eyebrow>INKD design system</Eyebrow>
            <AppearanceControl />
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            Component gallery
          </h1>
          <p className="max-w-xl text-content-secondary">
            Every primitive in <span className="font-mono text-content-accent">@inkd/ui/web</span> —
            solid violet plates, hard placard edges, and a warm{" "}
            <span className="text-content-ember">ember</span> accent for flash and
            price marks. Bricolage / Manrope / JetBrains Mono, plus Caveat by hand.
            Flip the toggle to review both themes.
          </p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-6 py-12">
        <Section title="Typography">
          <div className="flex flex-col gap-3">
            <Eyebrow>Mono eyebrow · the signature placard</Eyebrow>
            <p className="font-display text-5xl font-extrabold tracking-tight">
              Display — Bricolage Grotesque
            </p>
            <p className="font-sans text-lg text-content-secondary">
              Body — Manrope. The recessive workhorse for dense ops UI, tuned for
              long reading and small sizes.
            </p>
            <p className="font-mono text-sm text-content-muted">
              Mono — JetBrains Mono · IDs, timestamps, agent-log lines
            </p>
            <p className="font-hand text-3xl text-content-ember">
              Hand — Caveat · annotations, stamps, congrats (sparingly)
            </p>
          </div>
        </Section>

        <Section title="Buttons">
          <Row>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </Row>
          <Row>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button leadingIcon={<Icon name="plus" size={16} />}>New booking</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
            <Button size="icon" aria-label="Search">
              <Icon name="search" size={18} />
            </Button>
          </Row>
        </Section>

        <Section title="Badges & chips">
          <Row>
            <Badge variant="brand">Draft-only</Badge>
            <Badge variant="ember">Flash</Badge>
            <Badge variant="success">Deposit paid</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="danger">Overdue</Badge>
            <Badge variant="info">Consult</Badge>
            <Badge variant="neutral">Client</Badge>
            <Badge variant="outline">Artist</Badge>
          </Row>
          <Row>
            {styleTags.map((tag) => (
              <Chip
                key={tag}
                selected={chips.includes(tag)}
                onClick={() =>
                  setChips((prev) =>
                    prev.includes(tag)
                      ? prev.filter((t) => t !== tag)
                      : [...prev, tag],
                  )
                }
              >
                {tag}
              </Chip>
            ))}
            <Chip leadingIcon={<Icon name="map-pin" size={14} />} onRemove={() => {}}>
              Baltimore
            </Chip>
          </Row>
        </Section>

        <Section title="Avatars">
          <Row>
            <Avatar name="Jayden Cole" size="xs" />
            <Avatar name="Mara Fine" size="sm" />
            <Avatar name="Dez T" size="md" />
            <Avatar name="Ito Irezumi" size="lg" />
            <Avatar name="Sol Script" size="xl" />
            <Avatar name="Square" shape="square" size="lg" />
          </Row>
        </Section>

        <Section title="Cards">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Consultation</CardTitle>
                <CardDescription>30 min · video or in-studio</CardDescription>
              </CardHeader>
              <CardContent>
                Talk through placement, size and references before booking a
                session.
              </CardContent>
              <CardFooter>
                <Button size="sm">Book</Button>
                <Button size="sm" variant="ghost">
                  Details
                </Button>
              </CardFooter>
            </Card>
            <Card variant="interactive">
              <CardHeader>
                <CardTitle>Full-day session</CardTitle>
                <CardDescription>$1,200 · $300 deposit</CardDescription>
              </CardHeader>
              <CardContent>An interactive card — hover to feel the lift.</CardContent>
            </Card>
            {/* Placard card: a solid mono header strip + a stamped ember price. */}
            <Card padding="none" variant="raised">
              <CardPlacard meta="Flash">Neo-traditional</CardPlacard>
              <div className="flex items-start justify-between gap-3 p-5">
                <div className="flex flex-col gap-1">
                  <CardTitle>Panther, ready to drop</CardTitle>
                  <CardDescription>One sitting · @dez.ttt</CardDescription>
                </div>
                <Badge variant="ember">$260</Badge>
              </div>
            </Card>
          </div>
        </Section>

        <Section title="Form controls">
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField label="Handle" description="This is your public @." htmlFor="g-handle">
              <Input id="g-handle" placeholder="jayden.ink" leadingIcon={<Icon name="user" size={16} />} defaultValue="jayden.ink" />
            </FormField>
            <FormField label="Deposit" htmlFor="g-dep" error="Enter an amount over $0.">
              <Input id="g-dep" invalid placeholder="$0" leadingIcon={<Icon name="credit-card" size={16} />} />
            </FormField>
            <FormField label="Primary style" htmlFor="g-style">
              <Select
                id="g-style"
                placeholder="Choose a style"
                options={styleTags.map((s) => ({ label: s, value: s }))}
              />
            </FormField>
            <FormField label="Session date" htmlFor="g-date">
              <DateField id="g-date" />
            </FormField>
            <FormField label="Start time" htmlFor="g-time">
              <TimeField id="g-time" />
            </FormField>
            <FormField label="Bio" htmlFor="g-bio" description="Shown on your profile.">
              <TextArea id="g-bio" rows={3} placeholder="Baltimore-based, blackwork & fine line…" />
            </FormField>
          </div>

          <Divider className="my-2" />

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-4">
              <Checkbox
                checked={check}
                onCheckedChange={setCheck}
                label="Require a deposit to hold the slot"
                description="Recommended for full-day work."
              />
              <Toggle checked={toggle} onCheckedChange={setToggle} label="Open my books" />
            </div>
            <RadioGroup
              value={radio}
              onValueChange={setRadio}
              options={[
                { label: "No-AI", value: "none", description: "Internal organizing only." },
                { label: "Draft-only", value: "draft", description: "Assistant drafts, you send." },
                { label: "Assisted", value: "assisted", description: "Tier 1 auto, rest drafted." },
              ]}
            />
          </div>

          <div className="max-w-md pt-2">
            <Slider
              label="Agent autonomy"
              value={slider}
              onValueChange={setSlider}
              min={0}
              max={3}
              step={1}
            />
          </div>
        </Section>

        <Section title="Progress & steps">
          <div className="flex flex-col gap-6">
            <ProgressBar value={60} label="Portfolio import" showValue />
            <Stepper
              current={2}
              steps={[
                { label: "Identity" },
                { label: "Location" },
                { label: "Booking" },
                { label: "Services" },
                { label: "Verify" },
              ]}
            />
          </div>
        </Section>

        <Section title="Loading">
          <Row>
            <Spinner />
            <Spinner size={28} />
          </Row>
          <div className="flex max-w-sm flex-col gap-3 pt-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs
            value={tab}
            onValueChange={setTab}
            items={[
              { value: "overview", label: "Overview" },
              { value: "portfolio", label: "Portfolio", icon: <Icon name="image" size={16} /> },
              { value: "reviews", label: "Reviews", icon: <Icon name="star" size={16} /> },
            ]}
          />
          <p className="pt-3 text-sm text-content-muted">
            Active tab: <span className="font-mono text-content-accent">{tab}</span>
          </p>
        </Section>

        <Section title="Overlays & toast">
          <Row>
            <Button onClick={() => setModal(true)}>Open modal</Button>
            <Button variant="secondary" onClick={() => setSheet(true)}>
              Open sheet
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast({
                  title: "Deposit requested",
                  description: "We sent Mara a $300 hold.",
                  variant: "success",
                })
              }
            >
              Fire a toast
            </Button>
          </Row>
          <Modal
            open={modal}
            onClose={() => setModal(false)}
            title="Request a deposit"
            description="Hold the slot with a card on file."
            footer={
              <>
                <Button variant="ghost" onClick={() => setModal(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setModal(false)}>Send request</Button>
              </>
            }
          >
            <p className="text-sm text-content-secondary">
              The client gets a link to pay the deposit. Nothing is charged until
              they confirm.
            </p>
          </Modal>
          <Sheet open={sheet} onClose={() => setSheet(false)} title="Filters">
            <div className="flex flex-col gap-4">
              <p className="text-sm text-content-secondary">
                Bottom sheet — used for filters and pickers on small screens.
              </p>
              <div className="flex flex-wrap gap-2">
                {styleTags.map((tag) => (
                  <Chip key={tag}>{tag}</Chip>
                ))}
              </div>
            </div>
          </Sheet>
        </Section>

        <Section title="Empty state">
          <div className="rounded-sm border border-border-subtle bg-surface-raised">
            <EmptyState
              icon={<Icon name="calendar" size={26} />}
              note="nothing on the books — yet"
              title="No bookings yet"
              description="Inquiries, consults and sessions will move through here."
              action={<Button size="sm">Add a booking</Button>}
            />
          </div>
        </Section>

        <Section title="Icons">
          <div className="grid grid-cols-6 gap-3 sm:grid-cols-9">
            {allIcons.map((name) => (
              <div
                key={name}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-border-subtle bg-surface-raised text-content-secondary"
                title={name}
              >
                <Icon name={name} size={20} />
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
        <span className="h-px flex-1 bg-border-subtle" />
      </div>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}
