"use client";

/**
 * Client-side provider tree for the Next.js app. Instantiates the browser
 * Supabase client (`@inkd/core/auth/web`, cookie-backed via `@supabase/ssr`)
 * once per mount and wires it into `InkdProvider` so every TanStack Query
 * hook in `@inkd/core/hooks` works app-wide. Also mounts the design system's
 * `ToastProvider` so any screen can call `useToast()`.
 *
 * Kept as a small client boundary so `app/layout.tsx` stays a server
 * component (metadata export, self-hosted fonts, no client JS at the root).
 */
import { useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@inkd/core/auth/web";
import { InkdProvider } from "@inkd/core/hooks";
import { ToastProvider } from "@inkd/ui/web";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createBrowserSupabaseClient());

  return (
    <ThemeProvider>
      <InkdProvider client={supabase}>
        <ToastProvider>{children}</ToastProvider>
      </InkdProvider>
    </ThemeProvider>
  );
}
