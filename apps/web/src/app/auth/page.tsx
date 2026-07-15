"use client";

/**
 * Functional (intentionally unstyled) auth screen: email+password sign-in and
 * sign-up plus a passwordless magic-link option. The design agent owns the
 * visual treatment; this route exists to make the auth flow work end-to-end.
 *
 * Uses the @supabase/ssr browser client so the session is written to cookies
 * and shared with server components + middleware.
 */
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createBrowserSupabaseClient,
} from "@inkd/core/auth/web";
import {
  signInWithPassword,
  signUpWithPassword,
  signInWithMagicLink,
} from "@inkd/core/auth";

type Mode = "sign-in" | "sign-up";

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(
    params.get("error") ? "Authentication failed. Please try again." : null,
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
      setMessage("Magic link sent — check your email.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: "48px auto", padding: 16 }}>
      <h1>{mode === "sign-in" ? "Sign in" : "Create your account"}</h1>

      <form onSubmit={handlePasswordSubmit}>
        {mode === "sign-up" && (
          <label style={{ display: "block", marginBottom: 8 }}>
            Name
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              style={{ display: "block", width: "100%" }}
            />
          </label>
        )}

        <label style={{ display: "block", marginBottom: 8 }}>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={{ display: "block", width: "100%" }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            style={{ display: "block", width: "100%" }}
          />
        </label>

        <button type="submit" disabled={pending} style={{ marginTop: 8 }}>
          {pending
            ? "Working…"
            : mode === "sign-in"
              ? "Sign in"
              : "Sign up"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleMagicLink}
        disabled={pending || !email}
        style={{ marginTop: 8 }}
      >
        Email me a magic link
      </button>

      <p style={{ marginTop: 16 }}>
        {mode === "sign-in" ? (
          <button type="button" onClick={() => setMode("sign-up")}>
            Need an account? Sign up
          </button>
        ) : (
          <button type="button" onClick={() => setMode("sign-in")}>
            Already have an account? Sign in
          </button>
        )}
      </p>

      {message && (
        <p role="status" style={{ marginTop: 16 }}>
          {message}
        </p>
      )}
    </main>
  );
}
