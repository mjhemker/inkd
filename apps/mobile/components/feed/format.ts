/** Small formatting helpers for the discovery feed (mobile). */

/** cents -> "$120" (or "$120.50" when there are cents worth showing). */
export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return "Price on request";
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

/** The museum-placard byline: style tag(s) · @handle · city. */
export function placardLine(parts: {
  styleNames: string[];
  handle: string | null;
  city: string | null;
  state: string | null;
}): string {
  const segments: string[] = [];
  if (parts.styleNames.length > 0) segments.push(parts.styleNames.slice(0, 2).join(" / "));
  if (parts.handle) segments.push(`@${parts.handle}`);
  const location = [parts.city, parts.state].filter(Boolean).join(", ");
  if (location) segments.push(location);
  return segments.join(" · ") || "INKD ARTIST";
}
