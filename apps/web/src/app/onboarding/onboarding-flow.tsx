"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Eyebrow,
  Icon,
  ProgressBar,
  Spinner,
  useToast,
} from "@inkd/ui/web";
import {
  useCurrentProfile,
  useCurrentArtistProfile,
  useEnsureArtist,
  useSetOnboardingStep,
} from "@inkd/core/hooks";
import {
  AgentAutonomyEditor,
  BookingEditor,
  IdentityEditor,
  LocationsEditor,
  ServicesEditor,
  STEP_META,
  type EditorHandle,
} from "@/components/artist";

const STEP_COPY = [
  {
    title: "Let's set up your chair",
    subtitle:
      "Start with the basics clients see first — your name, your handle, and a few pieces of work.",
  },
  {
    title: "Where do you work?",
    subtitle: "Add your studio (or studios), and how you like to travel.",
  },
  {
    title: "Your books",
    subtitle:
      "Set your hours, how far out you take bookings, and meet your AI front desk.",
  },
  {
    title: "Services & rates",
    subtitle: "Add what clients can book, with your prices and deposits.",
  },
  {
    title: "One last thing",
    subtitle: "Verify your identity to unlock payouts — or skip it for now.",
  },
];

export function OnboardingFlow() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const { data: artist, isLoading: artistLoading } = useCurrentArtistProfile();
  const ensureArtist = useEnsureArtist();

  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const editorRef = useRef<EditorHandle>(null);
  const ensuredRef = useRef(false);

  const setOnboardingStep = useSetOnboardingStep(artist?.id ?? "");

  // Ensure the artist profile exists, then resume at the saved step.
  useEffect(() => {
    if (ready || profileLoading || artistLoading) return;
    if (!artist && !ensuredRef.current) {
      ensuredRef.current = true;
      ensureArtist.mutate(undefined, {
        onSuccess: (created) => {
          setStep(Math.min(created.onboarding_step, 4));
          setReady(true);
        },
        onError: () => setReady(true),
      });
      return;
    }
    if (artist) {
      setStep(Math.min(artist.onboarding_step, 4));
      setReady(true);
    }
  }, [artist, profileLoading, artistLoading, ready, ensureArtist]);

  async function goNext() {
    setAdvancing(true);
    try {
      const ok = editorRef.current ? await editorRef.current.save() : true;
      if (!ok) return;
      if (artist) {
        const next = Math.min(step + 1, 5);
        await setOnboardingStep.mutateAsync({
          step: next,
          completed: next >= 5,
        });
      }
      if (step >= 4) {
        setDone(true);
      } else {
        setStep((s) => s + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    } finally {
      setAdvancing(false);
    }
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!ready || !profile || !artist) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface-base">
        <Spinner size={28} />
      </div>
    );
  }

  if (done) {
    return <CongratsScreen onFinish={() => router.push("/dashboard")} />;
  }

  const progress = ((step + 1) / 5) * 100;
  const meta = STEP_META[step] ?? STEP_META[0]!;
  const copy = STEP_COPY[step] ?? STEP_COPY[0]!;

  return (
    <div className="min-h-dvh bg-surface-base text-content-primary">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border-subtle bg-surface-base/90 px-5 backdrop-blur md:px-8">
        <span className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-on">
            <span className="font-display text-lg font-extrabold leading-none">
              I
            </span>
          </span>
          <span className="font-display text-xl font-bold tracking-tight">INKD</span>
        </span>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-content-muted outline-none transition-colors hover:text-content-primary focus-visible:text-content-primary"
        >
          Save &amp; exit
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-8 md:py-12 lg:grid-cols-[240px_1fr]">
        {/* Left rail — the studio setup checklist */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-1">
            <Eyebrow>Studio setup</Eyebrow>
            <ol className="mt-3 flex flex-col gap-0.5">
              {STEP_META.map((meta, i) => {
                const state =
                  i < step ? "done" : i === step ? "current" : "upcoming";
                return (
                  <li key={meta.key}>
                    <div
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                        state === "current" ? "bg-surface-raised" : ""
                      }`}
                    >
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md font-mono text-[11px] ${
                          state === "done"
                            ? "bg-brand text-brand-on"
                            : state === "current"
                              ? "border border-border-accent text-content-accent"
                              : "border border-border-subtle text-content-muted"
                        }`}
                      >
                        {state === "done" ? (
                          <Icon name="check" size={13} />
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </span>
                      <div className="flex flex-col">
                        <span
                          className={`text-sm font-medium ${
                            state === "upcoming"
                              ? "text-content-muted"
                              : "text-content-primary"
                          }`}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[11px] text-content-muted">
                          {meta.description}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>

        {/* Main column */}
        <main className="flex w-full max-w-2xl flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between lg:hidden">
              <Eyebrow>
                Step {step + 1} of 5 · {meta.label}
              </Eyebrow>
              <span className="font-mono text-xs text-content-muted">
                {Math.round(progress)}%
              </span>
            </div>
            <ProgressBar value={progress} />
            <div className="flex flex-col gap-1.5 pt-2">
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {copy.title}
              </h1>
              <p className="max-w-xl text-content-secondary">{copy.subtitle}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-surface-raised/50 p-5 sm:p-7">
            {step === 0 && (
              <IdentityEditor ref={editorRef} profile={profile} artist={artist} />
            )}
            {step === 1 && <LocationsEditor ref={editorRef} artist={artist} />}
            {step === 2 && (
              <div className="flex flex-col gap-9">
                <BookingEditor ref={editorRef} artist={artist} />
                <div className="flex flex-col gap-4 border-t border-border-subtle pt-8">
                  <div className="flex flex-col gap-1">
                    <h2 className="font-display text-lg font-bold tracking-tight">
                      Meet your AI front desk
                    </h2>
                    <p className="text-sm text-content-secondary">
                      Optional, and always under your control.
                    </p>
                  </div>
                  <AgentAutonomyEditor artist={artist} />
                </div>
              </div>
            )}
            {step === 3 && <ServicesEditor ref={editorRef} artistId={artist.id} />}
            {step === 4 && <VerifyStep />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="ghost" onClick={goBack} disabled={advancing}>
                <Icon name="chevron-left" size={16} />
                Back
              </Button>
            ) : (
              <span />
            )}
            <Button size="lg" onClick={() => void goNext()} loading={advancing}>
              {step === 4 ? "Skip for now — finish" : "Continue"}
              {step < 4 && <Icon name="arrow-right" size={18} />}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}

function VerifyStep() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised/40 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-overlay text-content-accent">
          <Icon name="shield" size={20} />
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-content-primary">
            Identity verification
          </span>
          <p className="text-sm text-content-secondary">
            Before the pilot, we&apos;ll verify your identity through Stripe so you
            can take deposits and get paid out. It&apos;s a quick photo-ID check —
            we&apos;ll email you when it&apos;s ready. For now, you can skip this and
            explore your dashboard.
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-2.5">
        {[
          "Secure ID check handled by Stripe Identity",
          "Unlocks deposits and payouts via Stripe Connect",
          "Nothing to do today — we'll prompt you before launch",
        ].map((line) => (
          <li key={line} className="flex items-center gap-2.5 text-sm text-content-secondary">
            <Icon name="check" size={16} />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CongratsScreen({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface-base px-5 text-content-primary">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand text-brand-on shadow-glow">
          <Icon name="sparkles" size={30} />
        </span>
        <div className="flex flex-col gap-2">
          <Eyebrow>You&apos;re set up</Eyebrow>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Your chair is ready
          </h1>
          <p className="text-content-secondary">
            Your profile, studio, hours, and services are live. Head to your
            dashboard to take your first booking.
          </p>
        </div>
        <Button size="lg" onClick={onFinish}>
          Go to dashboard
          <Icon name="arrow-right" size={18} />
        </Button>
      </div>
    </div>
  );
}
