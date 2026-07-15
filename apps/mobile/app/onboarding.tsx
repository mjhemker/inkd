/**
 * Artist onboarding — a 5-step flow mirroring the web onboarding-flow.tsx:
 * identity, location, booking (+ AI front desk intro), services, and a
 * Stripe-Identity verification stub. Each step's editor exposes an
 * `EditorHandle.save()` that this screen calls before advancing and
 * persisting `artist_profiles.onboarding_step`.
 */
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Button,
  Eyebrow,
  Icon,
  ProgressBar,
  Spinner,
  ToastProvider,
  useToast,
} from "@inkd/ui/native";
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
    subtitle: "Set your hours, how far out you take bookings, and meet your AI front desk.",
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

export default function OnboardingScreen() {
  return (
    <ToastProvider>
      <OnboardingFlow />
    </ToastProvider>
  );
}

function OnboardingFlow() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const { data: artist, isLoading: artistLoading } = useCurrentArtistProfile();
  const ensureArtist = useEnsureArtist();

  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const primaryRef = useRef<EditorHandle>(null);
  const autonomyRef = useRef<EditorHandle>(null);
  const ensuredRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const setOnboardingStep = useSetOnboardingStep(artist?.id ?? "");

  // Ensure the artist profile exists, then resume at the saved step.
  useEffect(() => {
    if (ready || profileLoading || artistLoading) return;
    if (!artist && !ensuredRef.current) {
      ensuredRef.current = true;
      ensureArtist.mutate(undefined, {
        onSuccess: (created) => {
          setStep(Math.max(0, Math.min(created.onboarding_step, 4)));
          setReady(true);
        },
        onError: () => setReady(true),
      });
      return;
    }
    if (artist) {
      setStep(Math.max(0, Math.min(artist.onboarding_step, 4)));
      setReady(true);
    }
  }, [artist, profileLoading, artistLoading, ready, ensureArtist]);

  async function goNext() {
    setAdvancing(true);
    try {
      let ok = primaryRef.current ? await primaryRef.current.save() : true;
      if (ok && step === 2 && autonomyRef.current) {
        ok = await autonomyRef.current.save();
      }
      if (!ok) return;
      if (artist) {
        const next = Math.min(step + 1, 5);
        await setOnboardingStep.mutateAsync({ step: next, completed: next >= 5 });
      }
      if (step >= 4) {
        setDone(true);
      } else {
        setStep((s) => s + 1);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
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
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  if (!ready || !profile || !artist) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface-base">
        <Spinner size="large" />
      </SafeAreaView>
    );
  }

  if (done) {
    return <CongratsScreen onFinish={() => router.replace("/dashboard")} />;
  }

  const progress = ((step + 1) / 5) * 100;
  const meta = STEP_META[step] ?? STEP_META[0]!;
  const copy = STEP_COPY[step] ?? STEP_COPY[0]!;

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName="gap-6 px-6 py-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Eyebrow>{`Step ${step + 1} of 5 · ${meta.label}`}</Eyebrow>
            <Text className="font-mono text-xs text-content-muted">
              {Math.round(progress)}%
            </Text>
          </View>
          <ProgressBar value={progress} />
          <View className="gap-1.5 pt-1">
            <Text className="font-display text-2xl text-content-primary">{copy.title}</Text>
            <Text className="text-sm text-content-secondary">{copy.subtitle}</Text>
          </View>
        </View>

        <View className="rounded-2xl border border-border-subtle bg-surface-raised/50 p-4">
          {step === 0 && <IdentityEditor ref={primaryRef} profile={profile} artist={artist} />}
          {step === 1 && <LocationsEditor ref={primaryRef} artist={artist} />}
          {step === 2 && (
            <View className="gap-8">
              <BookingEditor ref={primaryRef} artist={artist} />
              <View className="gap-3 border-t border-border-subtle pt-6">
                <View className="gap-1">
                  <Text className="font-display text-lg text-content-primary">
                    Meet your AI front desk
                  </Text>
                  <Text className="text-sm text-content-secondary">
                    Optional, and always under your control.
                  </Text>
                </View>
                <AgentAutonomyEditor ref={autonomyRef} artist={artist} />
              </View>
            </View>
          )}
          {step === 3 && <ServicesEditor ref={primaryRef} artistId={artist.id} />}
          {step === 4 && <VerifyStep />}
        </View>

        {/* Footer */}
        <View className="flex-row items-center justify-between gap-3">
          {step > 0 ? (
            <Button variant="ghost" onPress={goBack} disabled={advancing}>
              <Icon name="chevron-left" size={16} color="#A1A1AA" />
              Back
            </Button>
          ) : (
            <View />
          )}
          <Button size="lg" onPress={() => void goNext()} loading={advancing}>
            {step === 4 ? "Skip for now — finish" : "Continue"}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function VerifyStep() {
  // Stripe Identity has no live keys yet (see docs/payments.md) — there's no
  // verification session to start. Rather than hide the action, we show it
  // and are honest about the gate on tap, so the step feels complete (a real
  // next action) instead of a dead end.
  const [showGateNotice, setShowGateNotice] = useState(false);
  const lines = [
    "Secure ID check handled by Stripe Identity",
    "Unlocks deposits and payouts via Stripe Connect",
    "Nothing to do today — we'll prompt you before launch",
  ];
  return (
    <View className="gap-6">
      <View className="flex-row items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised/40 p-4">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-overlay">
          <Icon name="shield" size={20} color="#A78BFA" />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-sm font-sans-medium text-content-primary">
            Identity verification
          </Text>
          <Text className="text-sm text-content-secondary">
            Before the pilot, we&apos;ll verify your identity through Stripe so you can take
            deposits and get paid out. It&apos;s a quick photo-ID check — we&apos;ll email you
            when it&apos;s ready. For now, you can skip this and explore your dashboard.
          </Text>
        </View>
      </View>
      <View className="gap-2.5">
        {lines.map((line) => (
          <View key={line} className="flex-row items-center gap-2.5">
            <Icon name="check" size={16} color="#A78BFA" />
            <Text className="flex-1 text-sm text-content-secondary">{line}</Text>
          </View>
        ))}
      </View>

      <View className="items-start gap-3">
        <Button
          size="lg"
          onPress={() => setShowGateNotice(true)}
          leadingIcon={<Icon name="shield" size={16} color="#0A0A0B" />}
        >
          Start ID verification
        </Button>
        {showGateNotice && (
          <View className="w-full flex-row items-start gap-2.5 rounded-xl border border-border-subtle bg-surface-overlay px-4 py-3">
            <Icon name="alert-triangle" size={16} color="#A78BFA" />
            <Text className="flex-1 text-sm text-content-secondary">
              Verification opens once payments are configured — you can skip for
              now.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function CongratsScreen({ onFinish }: { onFinish: () => void }) {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-surface-base px-6">
      <View className="max-w-md items-center gap-6">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand">
          <Icon name="sparkles" size={30} color="#FAFAFA" />
        </View>
        <View className="items-center gap-2">
          <Eyebrow>You&apos;re set up</Eyebrow>
          <Text className="text-center font-display text-3xl text-content-primary">
            Your chair is ready
          </Text>
          <Text className="text-center text-sm text-content-secondary">
            Your profile, studio, hours, and services are live. Head to your dashboard to
            take your first booking.
          </Text>
        </View>
        <Button size="lg" onPress={onFinish}>
          Go to dashboard
          <Icon name="arrow-right" size={18} color="#FAFAFA" />
        </Button>
      </View>
    </SafeAreaView>
  );
}
