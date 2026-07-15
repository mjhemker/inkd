import type { ReactNode } from "react";

/**
 * Minimal application shell for the INKD web app.
 *
 * Provides the persistent chrome (top bar + centered content column + footer)
 * that feature routes render into. Kept intentionally thin — navigation,
 * auth state and role switching (client | artist) land in later phases.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-base text-content-primary">
      <TopBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface-base/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span
            aria-hidden
            className="inline-block h-5 w-5 rounded-md bg-brand"
          />
          INKD
        </span>
        <span className="rounded-full border border-border-subtle px-3 py-1 text-xs font-medium text-content-secondary">
          Phase 0 · Scaffold
        </span>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border-subtle px-6 py-6">
      <p className="mx-auto w-full max-w-5xl text-xs text-content-muted">
        INKD · getinkd.co — Baltimore &amp; Philadelphia pilot
      </p>
    </footer>
  );
}
