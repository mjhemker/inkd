import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@inkd/core/auth/web";

/**
 * Root entry point (`/`). The old landing page now lives at `/preview` (see
 * apps/web/src/app/preview/page.tsx) so getinkd.co/ can serve the app itself.
 *
 * `/` is a thin, server-rendered router with no UI of its own:
 *   - signed out                         → /preview (the marketing landing)
 *   - signed in, client                  → /feed
 *   - signed in, artist, onboarding done → /dashboard
 *   - signed in, artist, mid-onboarding  → /onboarding
 *
 * This mirrors the role-derivation in apps/web/src/app/auth/callback/route.ts
 * (the post-login landing) so `/` and the auth callback always agree on where
 * a given account's "home" is. No redirect loops: /preview, /feed,
 * /dashboard, and /onboarding are all public-by-design or self-terminating
 * (see PROTECTED_ROUTE_PREFIXES / ARTIST_ROUTE_PREFIXES in
 * packages/core/src/auth/web.ts) and none of them route back through `/`.
 */
export default async function RootPage() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient({
    getAll: () => cookieStore.getAll(),
    // Read-only redirect gate — no cookie writes here. Middleware already
    // refreshes the session cookie on every request before this renders.
    setAll: () => {},
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/preview");

  const destination = await resolveAuthedHome(supabase, user.id);
  redirect(destination);
}

/**
 * Resolve a signed-in user's home surface from their role + onboarding
 * state. Best-effort — any lookup failure falls back to `/feed`, which is
 * safe for every account type. Deliberately returns a string rather than
 * calling `redirect()` itself, so the throw-based redirect always happens
 * outside this try/catch.
 */
async function resolveAuthedHome(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  userId: string,
): Promise<string> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_artist")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.is_artist) return "/feed";

    const { data: artist } = await supabase
      .from("artist_profiles")
      .select("onboarding_completed_at")
      .eq("profile_id", userId)
      .maybeSingle();

    if (!artist || !artist.onboarding_completed_at) return "/onboarding";
    return "/dashboard";
  } catch {
    return "/feed";
  }
}
