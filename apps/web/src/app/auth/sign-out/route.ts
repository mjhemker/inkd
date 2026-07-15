/** Sign the current user out (clears the session cookies) and redirect to /auth. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@inkd/core/auth/web";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) => {
      for (const { name, value, options } of toSet) {
        cookieStore.set(name, value, options);
      }
    },
  });
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/auth", new URL(request.url).origin), {
    status: 303,
  });
}
