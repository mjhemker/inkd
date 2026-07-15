// POST /functions/v1/create-deposit-checkout
//
// CONTRACT (the booking agent builds against this exactly):
//   POST /functions/v1/create-deposit-checkout  { session_id }  ->  { url }
//
// Authenticated client pays the deposit for one of their sessions. We validate
// ownership + the deposit amount (from the service's deposit policy), then open
// a Stripe Checkout Session as a DESTINATION CHARGE to the artist's connected
// account with application_fee_amount = the INKD fee. Client is redirected to
// `url`; the webhook records the ledger row once payment completes.
import { handlePreflight } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { getStripe } from "../_shared/stripe.ts";
import { resolveAppUrl, resolveCurrency, resolveInkdFeeBps } from "../_shared/env.ts";
import { AppError, errors, errorResponse, jsonResponse } from "../_shared/errors.ts";
import {
  computeInkdFeeCents,
  resolveDepositCents,
  STRIPE_MIN_CHARGE_CENTS,
  type ServiceDepositPolicy,
} from "../_shared/fees.ts";
import { META } from "../_shared/webhook.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") throw errors.badRequest("Use POST");

    const user = await requireUser(req);

    const body = await safeJson(req);
    const sessionId = str(body?.session_id);
    if (!sessionId) throw errors.badRequest("session_id is required");

    const admin = getAdminClient();

    // Load the session; then its booking (for the service) and the artist.
    const { data: session, error: sErr } = await admin
      .from("sessions")
      .select(
        "id, client_id, artist_id, booking_id, deposit_cents, deposit_paid",
      )
      .eq("id", sessionId)
      .maybeSingle();
    if (sErr) throw errors.server(sErr.message);
    if (!session) throw errors.notFound("Session not found");

    // Ownership: only the client on the session may pay its deposit.
    if (session.client_id !== user.id) {
      throw errors.forbidden("You cannot pay for this session");
    }
    if (session.deposit_paid) {
      throw errors.conflict("Deposit already paid for this session");
    }

    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select("id, service_id, title")
      .eq("id", session.booking_id)
      .maybeSingle();
    if (bErr) throw errors.server(bErr.message);

    let service: ServiceDepositPolicy | null = null;
    if (booking?.service_id) {
      const { data: svc, error: svcErr } = await admin
        .from("services")
        .select("deposit_type, deposit_amount_cents, deposit_percent, price_cents, name")
        .eq("id", booking.service_id)
        .maybeSingle();
      if (svcErr) throw errors.server(svcErr.message);
      service = (svc as ServiceDepositPolicy | null) ?? null;
    }

    // The artist must have a Connect account able to accept charges.
    const { data: artist, error: aErr } = await admin
      .from("artist_profiles")
      .select("id, stripe_account_id, stripe_charges_enabled")
      .eq("id", session.artist_id)
      .maybeSingle();
    if (aErr) throw errors.server(aErr.message);
    if (!artist?.stripe_account_id || !artist.stripe_charges_enabled) {
      throw errors.conflict("Artist is not set up to accept payments yet");
    }

    // Resolve deposit + INKD fee.
    const depositCents = resolveDepositCents({ session, service });
    if (depositCents < STRIPE_MIN_CHARGE_CENTS) {
      throw errors.badRequest(
        `Deposit must be at least ${STRIPE_MIN_CHARGE_CENTS} cents`,
      );
    }
    const feeBps = resolveInkdFeeBps();
    const inkdFeeCents = computeInkdFeeCents(depositCents, feeBps);
    const currency = resolveCurrency();
    const appUrl = resolveAppUrl();

    const productName = service?.name
      ? `Deposit — ${service.name}`
      : booking?.title
        ? `Deposit — ${booking.title}`
        : "Session deposit";

    const metadata: Record<string, string> = {
      [META.sessionId]: session.id,
      [META.bookingId]: session.booking_id,
      [META.artistId]: session.artist_id,
      [META.clientId]: session.client_id,
      [META.kind]: "deposit",
      [META.depositCents]: String(depositCents),
      [META.feeCents]: String(inkdFeeCents),
    };

    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: depositCents,
            product_data: { name: productName },
          },
        },
      ],
      payment_intent_data: {
        // Destination charge: settle on the platform, transfer net to the artist.
        application_fee_amount: inkdFeeCents,
        transfer_data: { destination: artist.stripe_account_id },
        metadata,
      },
      // Mirror metadata on the Checkout Session so checkout.session.completed
      // carries it even before the PaymentIntent is expanded.
      metadata,
      success_url: `${appUrl}/booking/${session.booking_id}?deposit=success&session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/booking/${session.booking_id}?deposit=cancelled`,
    });

    if (!checkout.url) throw errors.server("Stripe did not return a checkout URL");
    return jsonResponse({ url: checkout.url });
  } catch (err) {
    if (!(err instanceof AppError)) console.error("create-deposit-checkout:", err);
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
