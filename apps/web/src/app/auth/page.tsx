"use client";

/**
 * Auth screen: email+password sign-in and sign-up plus a passwordless
 * magic-link option, styled to match the INKD dark gallery aesthetic
 * (see `app/page.tsx` and `dev/ui`). All logic — zod validation via the
 * shared core auth helpers, magic link, `?next=` redirect, error states —
 * is unchanged from the functional pass; this is a reskin.
 *
 * Uses the @supabase/ssr browser client so the session is written to cookies
 * and shared with server components + middleware.
 */
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createBrowserSupabaseClient,
} from "@inkd/core/auth/web";
import {
  signInWithPassword,
  signUpWithPassword,
  signInWithMagicLink,
} from "@inkd/core/auth";
import {
  Button,
  Card,
  CardContent,
  Eyebrow,
  FormField,
  Icon,
  Input,
  Tabs,
} from "@inkd/ui/web";

type Mode = "sign-in" | "sign-up";

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthShell />
    </Suspense>
  );
}

function AuthShell() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-surface-base text-content-primary">
      {/* Solid violet plate rule across the top — no ambient glow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-1.5 bg-brand"
      />

      <header className="border-b border-border-subtle">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 md:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-on">
              <span className="font-display text-lg font-extrabold leading-none">
                I
              </span>
            </span>
            <span className="font-display text-xl font-bold tracking-tight">
              INKD
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-content-secondary transition-colors hover:text-content-primary"
          >
            Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-5 py-16 md:px-8 md:py-24">
        <div className="flex flex-col items-center gap-3 text-center">
          <Eyebrow>Baltimore &middot; Philadelphia &mdash; now onboarding</Eyebrow>
          <h1 className="font-display text-4xl font-extrabold leading-[0.98] tracking-tight sm:text-5xl">
            Welcome to{" "}
            <span className="text-content-accent">INKD</span>
          </h1>
          <p className="max-w-sm text-content-secondary">
            One account for artists and clients. Bookings, deposits and chat
            &mdash; agents that show their work.
          </p>
        </div>

        <AuthForm />
      </main>
    </div>
  );
}

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(
    params.get("error") ? "Authentication failed. Please try again." : null,
  );
  const [messageTone, setMessageTone] = useState<"error" | "info">(
    params.get("error") ? "error" : "info",
  );

  const next = params.get("next") ?? "/dashboard";
  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      : undefined;

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      if (mode === "sign-up") {
        const { error } = await signUpWithPassword(
          supabase,
          { email, password, displayName: displayName || undefined },
          { emailRedirectTo: callbackUrl },
        );
        if (error) throw error;
        setMessageTone("info");
        setMessage("Check your email to confirm your account, then sign in.");
        setMode("sign-in");
      } else {
        const { error } = await signInWithPassword(supabase, {
          email,
          password,
        });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      }
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function handleMagicLink() {
    setPending(true);
    setMessage(null);
    try {
      const { error } = await signInWithMagicLink(supabase, {
        email,
        emailRedirectTo: callbackUrl,
      });
      if (error) throw error;
      setMessageTone("info");
      setMessage("Magic link sent — check your email.");
    } catch (err) {
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-md" padding="lg">
      <Tabs
        value={mode}
        onValueChange={(value) => {
          setMode(value as Mode);
          setMessage(null);
        }}
        items={[
          { value: "sign-in", label: "Sign in" },
          { value: "sign-up", label: "Create account" },
        ]}
        className="mb-6"
      />

      <CardContent>
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-5">
          {mode === "sign-up" && (
            <FormField label="Name" htmlFor="auth-name">
              <Input
                id="auth-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                placeholder="Jayden Cole"
                leadingIcon={<Icon name="user" size={16} />}
              />
            </FormField>
          )}

          <FormField label="Email" htmlFor="auth-email" required>
            <Input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@studio.com"
              leadingIcon={<Icon name="message-circle" size={16} />}
            />
          </FormField>

          <FormField
            label="Password"
            htmlFor="auth-password"
            required
            description="At least 8 characters"
          >
            <Input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              placeholder="Your password"
              leadingIcon={<Icon name="shield" size={16} />}
              trailingInteractive
              trailingIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="font-mono text-[11px] uppercase tracking-wide text-content-muted outline-none hover:text-content-primary focus-visible:text-content-primary"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              }
            />
          </FormField>

          <Button type="submit" size="lg" loading={pending} className="mt-1">
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border-subtle" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-content-muted">
            Or
          </span>
          <span className="h-px flex-1 bg-border-subtle" />
        </div>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={handleMagicLink}
          disabled={pending || !email}
          leadingIcon={<Icon name="sparkles" size={16} />}
        >
          Email me a magic link
        </Button>

        {message && (
          <p
            role="status"
            className={
              messageTone === "error"
                ? "mt-5 rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2.5 text-sm text-danger-500"
                : "mt-5 rounded-lg border border-border-subtle bg-surface-overlay px-3 py-2.5 text-sm text-content-secondary"
            }
          >
            {message}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-content-muted">
          {mode === "sign-in" ? (
            <>
              Need an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("sign-up");
                  setMessage(null);
                }}
                className="font-medium text-content-accent transition-colors hover:text-content-primary"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("sign-in");
                  setMessage(null);
                }}
                className="font-medium text-content-accent transition-colors hover:text-content-primary"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
