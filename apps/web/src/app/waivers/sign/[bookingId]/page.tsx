import type { Metadata } from "next";
import Link from "next/link";
import { ClientSigningFlow } from "@/components/waivers/ClientSigningFlow";

export const metadata: Metadata = { title: "Sign your consent form" };

/**
 * Client waiver signing flow. Deliberately outside the `(app)` route group —
 * like /onboarding, this is a focused task screen, not a dashboard surface —
 * so it doesn't touch AppShell/nav. Auth is enforced in the client component
 * itself (via useCurrentProfile) rather than middleware, since /waivers isn't
 * in the shared PROTECTED_ROUTE_PREFIXES list owned by the auth module.
 */
export default async function SignWaiverPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;

  return (
    <div className="min-h-dvh bg-surface-base text-content-primary">
      <header className="flex h-16 items-center justify-between border-b border-border-subtle px-5 md:px-8">
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
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-10 md:py-16">
        <ClientSigningFlow bookingId={bookingId} />
      </main>
    </div>
  );
}
