// POST /functions/v1/connect-onboarding-link
//
// Authenticated artist -> create (or reuse) a Stripe Connect Express account,
// persist the account id on artist_profiles, and return a one-time Stripe
// account-link URL the artist opens to complete onboarding (and, later,
// identity verification which unlocks payouts).
//
// Request:  (no body required) optional { return_url, refresh_url }
// Response: { url, account_id, charges_enabled }
import { handlePreflight } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { getStripe } from "../_shared/stripe.ts";
import { resolveAppUrl } from "../_shared/env.ts";
import { AppError, errors, errorResponse, jsonResponse } from "../_shared/errors.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") throw errors.badRequest("Use POST");

    const user = await requireUser(req);
    const admin = getAdminClient();

    // The caller must be an artist.
    const { data: artist, error: artistErr } = await admin
      .from("artist_profiles")
      .select("id, profile_id, stripe_account_id, stripe_charges_enabled")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (artistErr) throw errors.server(artistErr.message);
    if (!artist) throw errors.forbidden("Only artists can onboard payouts");

    const stripe = getStripe();

    // Reuse an existing connected account, or create a new Express one.
    let accountId = artist.stripe_account_id as string | null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: user.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: { inkd_artist_id: artist.id, inkd_profile_id: user.id },
      });
      accountId = account.id;

      const { error: updErr } = await admin
        .from("artist_profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", artist.id);
      if (updErr) throw errors.server(updErr.message);
    }

    // Where Stripe sends the artist back to after finishing / refreshing.
    const appUrl = resolveAppUrl();
    const body = await safeJson(req);
    const returnUrl = str(body?.return_url) ?? `${appUrl}/dashboard/payments?connect=return`;
    const refreshUrl = str(body?.refresh_url) ?? `${appUrl}/dashboard/payments?connect=refresh`;

    const link = await stripe.accountLinks.create({
      account: accountId,
      return_url: returnUrl,
      refresh_url: refreshUrl,
      type: "account_onboarding",
    });

    return jsonResponse({
      url: link.url,
      account_id: accountId,
      charges_enabled: Boolean(artist.stripe_charges_enabled),
    });
  } catch (err) {
    if (!(err instanceof AppError)) console.error("connect-onboarding-link:", err);
    return errorResponse(err);
  }
});

async function safeJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}
