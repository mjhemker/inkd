/**
 * OAuth / magic-link / email-confirmation callback. Exchanges the `code` in the
 * URL for a session, writes it to cookies, then routes the user to the right
 * first surface:
 *   - artist with incomplete onboarding  → /onboarding
 *   - artist with completed onboarding   → /dashboard (or an explicit `next`)
 *   - client                             → /feed (or an explicit `next`)
 *
 * A meaningful `next` (anything other than the generic default) is always
 * honored — e.g. a magic link that was meant to land on a specific page. Only
 * the default post-confirmation landing is role-derived.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@inkd/core/auth/web";

const DEFAULT_NEXT = "/dashboard";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient({
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          cookieStore.set(name, value, options);
        }
      },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = await resolveDestination(supabase, next);
      return NextResponse.redirect(new URL(destination, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/auth?error=auth_callback", url.origin));
}

/**
 * Decide where to send a freshly-authenticated user. Honors an explicit,
 * non-default `next`; otherwise derives the landing from the account's role and
 * onboarding state. Best-effort — any failure falls back to the feed, which is
 * safe for every account type.
 */
async function resolveDestination(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  next: string | null,
): Promise<string> {
  // An explicit destination the user was bounced from (or deep-linked to) wins.
  if (next && next !== DEFAULT_NEXT) return next;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "/feed";

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_artist")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_artist) return "/feed";

    // Artist: send to onboarding until it's finished, then the dashboard.
    const { data: artist } = await supabase
      .from("artist_profiles")
      .select("onboarding_completed_at")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!artist || !artist.onboarding_completed_at) return "/onboarding";
    return "/dashboard";
  } catch {
    return "/feed";
  }
}
