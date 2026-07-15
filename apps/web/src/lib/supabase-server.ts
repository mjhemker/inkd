import "server-only";

import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@inkd/core/auth/web";

/**
 * Read-only server client for Server Components (e.g. the public `/a/[handle]`
 * artist profile page). Server Components can't write cookies mid-render, so
 * `setAll` is a best-effort no-op — session refresh already happens in
 * `middleware.ts`, this client only ever needs to read the current session.
 */
export async function getServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerSupabaseClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {
      // No-op: Server Components can't set cookies. Middleware refreshes
      // the session on every request, which is sufficient for reads here.
    },
  });
}
