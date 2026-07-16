/**
 * POST /api/match-inspiration — the authenticated proxy for the bearer-gated
 * `tag-image` edge function (inline mode).
 *
 * The `tag-image` function is gated by the AI-runtime bearer (AGENT_RUNNER_TOKEN
 * or the service-role key) — NOT a user JWT — so a browser/app can't call it
 * directly (see docs/ai-image-tagging.md + packages/core/api/similarWorks.ts).
 * This route authenticates the caller (cookie session on web, or a forwarded
 * Supabase access token on mobile), then calls `tag-image` with the runner
 * bearer and returns the query image's inline tags + embedding. Nothing is
 * persisted — the inspiration image is transient.
 *
 * Env (server-only): AGENT_RUNNER_TOKEN (preferred) or SUPABASE_SERVICE_ROLE_KEY
 * for the tag-image bearer. Absent → 503 not_configured (the UI degrades to
 * "browse by style"). NEXT_PUBLIC_SUPABASE_URL locates the function.
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

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function resolveUserId(req: Request): Promise<string | null> {
  // Mobile / cross-origin: a forwarded Supabase access token.
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  if (bearer) {
    try {
      const client = createBrowserSupabaseClient();
      const { data } = await client.auth.getUser(bearer);
      if (data.user?.id) return data.user.id;
    } catch {
      // fall through to cookie session
    }
  }
  // Web / same-origin: the cookie session.
  try {
    const cookieStore = await cookies();
    const client = createServerSupabaseClient({
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    });
    const { data } = await client.auth.getUser();
    return data.user?.id ?? null;
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

  const userId = await resolveUserId(req);
  if (!userId) return err("unauthorized", "Sign in to search by image", 401);

  const runnerToken =
    process.env.AGENT_RUNNER_TOKEN?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  if (!runnerToken || !supabaseUrl) {
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
        Authorization: `Bearer ${runnerToken}`,
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
