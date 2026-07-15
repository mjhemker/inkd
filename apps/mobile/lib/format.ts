/** Small formatting helpers shared by the profile management + public artist
 * profile screens. Mirrors apps/web/src/lib/format.ts — kept as a separate
 * copy since the two apps don't share a non-@inkd/core lib layer. */
import type { AvailabilityRule, BookingWindow, Service } from "@inkd/core";

export function centsToDollars(cents: number | null | undefined): string {
  if (cents == null) return "";
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

export function servicePriceLabel(service: Pick<Service, "price_type" | "price_cents">): string {
  const { price_type, price_cents } = service;
  if (price_type === "quote") return "Quote on request";
  if (price_cents == null) return "Rate on request";
  const amount = centsToDollars(price_cents);
  if (price_type === "hourly") return `${amount}/hr`;
  if (price_type === "starting_at") return `From ${amount}`;
  return amount;
}

export function flashPriceLabel(priceCents: number | null | undefined): string {
  if (priceCents == null) return "Price on request";
  return centsToDollars(priceCents);
}

const BOOKING_WINDOW_LABELS: Record<BookingWindow, string> = {
  "1mo": "Booking ~1 month out",
  "2_3mo": "Booking 2–3 months out",
  "4_6mo": "Booking 4–6 months out",
  "1yr": "Booking up to a year out",
  closed: "Books closed",
};

export function bookingWindowLabel(window: BookingWindow | null | undefined): string {
  if (!window) return "Booking window not set";
  return BOOKING_WINDOW_LABELS[window];
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr ?? 0);
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, "0")}${period}`;
}

export function hoursSummary(rules: AvailabilityRule[]): string {
  const open = rules.filter((r) => r.is_open).sort((a, b) => a.weekday - b.weekday);
  if (open.length === 0) return "Hours not published yet";

  const days = open.map((r) => r.weekday);
  const isConsecutive = days.every((d, i) => i === 0 || d === days[i - 1]! + 1);
  const dayLabel = isConsecutive
    ? days.length === 1
      ? WEEKDAY_LABELS[days[0]!]
      : `${WEEKDAY_LABELS[days[0]!]}–${WEEKDAY_LABELS[days[days.length - 1]!]}`
    : days.map((d) => WEEKDAY_LABELS[d]).join(", ");

  const first = open[0]!;
  const sameHours = open.every(
    (r) => r.start_time === first.start_time && r.end_time === first.end_time,
  );
  const hoursLabel = sameHours
    ? `${formatTime(first.start_time)}–${formatTime(first.end_time)}`
    : "varies by day";

  return `${dayLabel} · ${hoursLabel}`;
}

export function classificationLabel(value: string | null | undefined): string {
  switch (value) {
    case "shop_owner":
      return "Shop owner";
    case "shop_resident":
      return "Shop resident";
    case "private_suite":
      return "Private suite";
    case "independent":
      return "Independent";
    default:
      return "Independent";
  }
}

export function travelBadges(profile: {
  travel_fly_out: boolean;
  travel_house_calls: boolean;
  travel_at_home: boolean;
}): string[] {
  const out: string[] = [];
  if (profile.travel_fly_out) out.push("Fly-out");
  if (profile.travel_house_calls) out.push("House calls");
  if (profile.travel_at_home) out.push("At-home");
  return out;
}
