/**
 * Next.js middleware: refresh the Supabase session on every request and gate the
 * protected app surfaces. Unauthenticated hits to a protected route are bounced
 * to /auth with a `next` param so we can return the user after they sign in.
 *
 * Session-refresh pattern per @supabase/ssr: build a server client bound to the
 * request/response cookie jars, then call getUser() so refreshed tokens are
 * written back onto the response.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  createServerSupabaseClient,
  isProtectedRoute,
  isArtistRoute,
  requiresCompletedOnboarding,
} from "@inkd/core/auth/web";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerSupabaseClient({
    getAll: () => request.cookies.getAll(),
    setAll: (toSet) => {
      for (const { name, value } of toSet) {
        request.cookies.set(name, value);
      }
      response = NextResponse.next({ request });
      for (const { name, value, options } of toSet) {
        response.cookies.set(name, value, options);
      }
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user && isProtectedRoute(pathname)) {
    const signInUrl = new URL("/auth", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Role + onboarding gating for the artist-only "Studio" surfaces. A signed-in
  // client must never reach these (nav role-leak fix); an artist mid-onboarding
  // is nudged to finish before the dashboard/studio ops load.
  if (user && isArtistRoute(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_artist")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_artist) {
      // Client (or downgraded artist) hitting an artist route → back to the feed.
      return NextResponse.redirect(new URL("/feed", request.url));
    }

    if (requiresCompletedOnboarding(pathname)) {
      const { data: artist } = await supabase
        .from("artist_profiles")
        .select("onboarding_completed_at")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (!artist || !artist.onboarding_completed_at) {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
    }
  }

  return response;
}

export const config = {
  // Run on everything except static assets + image optimizer.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
