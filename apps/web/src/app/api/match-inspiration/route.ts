/**
 * POST /api/match-inspiration — the authenticated proxy for the `tag-image`
 * edge function's read-only `inline` mode.
 *
 * ZERO-CONFIG on localhost. `tag-image` `inline` now accepts an ordinary
 * signed-in USER JWT (it persists nothing — see supabase/functions/tag-image),
 * so this route can simply forward the caller's own Supabase access token. No
 * server-side runner secret is required to run image search locally: if the
 * user is signed in and NEXT_PUBLIC_SUPABASE_URL is set (it always is — the app
 * can't boot otherwise), the feature works.
 *
 * A privileged runner token (AGENT_RUNNER_TOKEN / SUPABASE_SERVICE_ROLE_KEY) is
 * still used IN PREFERENCE when present (e.g. production), but is now OPTIONAL.
 * `not_configured` (503) is therefore reserved for the case the pipeline is
 * genuinely unreachable — the tag-image function itself lacks ANTHROPIC_API_KEY,
 * whose 503 is passed straight through — never merely "the operator didn't set a
 * proxy env locally".
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createServerSupabaseClient,
  createBrowserSupabaseClient,
} from "@inkd/core/auth/web";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  image_url?: unknown;
}

interface ResolvedAuth {
  userId: string;
  /** The caller's own Supabase access token, to forward as a zero-config bearer. */
  accessToken: string | null;
}

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function resolveAuth(req: Request): Promise<ResolvedAuth | null> {
  // Mobile / cross-origin: a forwarded Supabase access token IS the bearer.
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  if (bearer) {
    try {
      const client = createBrowserSupabaseClient();
      const { data } = await client.auth.getUser(bearer);
      if (data.user?.id) return { userId: data.user.id, accessToken: bearer };
    } catch {
      // fall through to cookie session
    }
  }
  // Web / same-origin: the cookie session. Pull both the user and the live
  // access token (to forward to tag-image inline as the user's own bearer).
  try {
    const cookieStore = await cookies();
    const client = createServerSupabaseClient({
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    });
    const { data: userData } = await client.auth.getUser();
    if (!userData.user?.id) return null;
    const { data: sessionData } = await client.auth.getSession();
    return {
      userId: userData.user.id,
      accessToken: sessionData.session?.access_token ?? null,
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return err("bad_request", "Expected a JSON body with image_url", 400);
  }
  const imageUrl = typeof body.image_url === "string" ? body.image_url : "";
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    return err("bad_request", "A valid image_url is required", 400);
  }

  const resolved = await resolveAuth(req);
  if (!resolved) return err("unauthorized", "Sign in to search by image", 401);

  // Prefer a configured runner token (production); otherwise forward the user's
  // own access token — inline mode accepts it, so no server env is needed.
  const runnerToken =
    process.env.AGENT_RUNNER_TOKEN?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  const bearer = runnerToken || resolved.accessToken || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  if (!bearer || !supabaseUrl) {
    return err(
      "not_configured",
      "Image search isn't switched on yet — browse by style meanwhile.",
      503,
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${supabaseUrl}/functions/v1/tag-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ mode: "inline", image_url: imageUrl }),
    });
  } catch (e) {
    return err(
      "upstream_unreachable",
      e instanceof Error ? e.message : "Could not reach the tagging service",
      502,
    );
  }

  const text = await upstream.text();
  // Pass the upstream JSON + status straight through (tags/embedding on success,
  // { error: { code, message } } on failure — the client maps not_configured).
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
