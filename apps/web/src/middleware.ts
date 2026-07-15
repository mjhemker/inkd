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

  if (!user && isProtectedRoute(request.nextUrl.pathname)) {
    const signInUrl = new URL("/auth", request.url);
    signInUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  // Run on everything except static assets + image optimizer.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
