/**
 * Waiver rendering + retention helpers (SPEC §2 "waivers ... MD/PA-aware,
 * e-signature, retention").
 *
 * Templates store body text with `{{token}}` placeholders and a
 * `required_fields` jsonb array describing the checkbox sections a signer
 * must acknowledge before submitting. This module is pure (no network) so it
 * is trivially unit-testable and usable from both web and native screens.
 *
 * DRAFT LEGAL CONTENT NOTICE: the template bodies this renders (seeded via
 * the waiver_templates migration, drafted in docs/waivers-DRAFT-for-review.md)
 * are marked "DRAFT — pending legal review" and must not be treated as
 * attorney-reviewed legal advice. See that doc for sourcing + open questions.
 */
import type { UsState, WaiverTemplate } from "../types/rows";

/** One acknowledgment the signer must check before they can submit. */
export interface WaiverRequiredField {
  /** Stable key, also used as the checkbox's form field name. */
  key: string;
  /** Checkbox label shown to the signer. */
  label: string;
  /** False for optional acknowledgments (e.g. photography consent). */
  required: boolean;
}

/** Context substituted into a template's `{{token}}` placeholders. */
export interface WaiverRenderContext {
  artistName: string;
  studioName?: string | null;
  studioAddress?: string | null;
  clientName?: string | null;
  procedureDescription?: string | null;
  placement?: string | null;
  sessionDate?: string | null;
  date: string;
}

const TOKEN_MAP: Record<keyof WaiverRenderContext, string> = {
  artistName: "artist_name",
  studioName: "studio_name",
  studioAddress: "studio_address",
  clientName: "client_name",
  procedureDescription: "procedure_description",
  placement: "placement",
  sessionDate: "session_date",
  date: "date",
};

const FALLBACKS: Partial<Record<keyof WaiverRenderContext, string>> = {
  studioName: "the studio",
  studioAddress: "the address provided at booking",
  clientName: "the undersigned client",
  procedureDescription: "the tattoo procedure discussed and agreed at booking",
  placement: "the placement discussed and agreed at booking",
  sessionDate: "the scheduled session date",
};

/**
 * Substitute `{{token}}` placeholders in a template body with values from
 * `ctx`. Unknown/blank values fall back to a neutral phrase so the rendered
 * document never shows a literal `{{...}}` or an empty gap.
 */
export function renderWaiverBody(
  body: string,
  ctx: WaiverRenderContext,
): string {
  let out = body;
  for (const key of Object.keys(TOKEN_MAP) as (keyof WaiverRenderContext)[]) {
    const token = TOKEN_MAP[key];
    const value = ctx[key];
    const replacement =
      value && String(value).trim().length > 0
        ? String(value)
        : (FALLBACKS[key] ?? "");
    out = out.replaceAll(`{{${token}}}`, replacement);
  }
  return out;
}

/** Parse a template's `required_fields` jsonb into typed acknowledgments.
 * Defensive against malformed/legacy rows — always returns an array. */
export function parseRequiredFields(
  template: Pick<WaiverTemplate, "required_fields">,
): WaiverRequiredField[] {
  const raw: unknown = template.required_fields;
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null && !Array.isArray(entry),
    )
    .map((entry) => ({
      key: String(entry.key ?? ""),
      label: String(entry.label ?? ""),
      required: entry.required !== false,
    }))
    .filter((f) => f.key.length > 0 && f.label.length > 0);
}

/**
 * Retention windows used for `signed_waivers.retention_until` (SPEC §2).
 *
 * MD: COMAR 10.06.01.06 requires body-art records be retained 3 years.
 * PA: Philadelphia Dept. of Public Health body-art regs require 2 years
 *     (statewide PA has no uniform body-art retention rule; Philadelphia's
 *     local rule is the binding one for the Philly pilot cohort).
 * Fallback (no state resolved): use the longer 3-year MD window so we never
 * under-retain when jurisdiction is ambiguous.
 *
 * DRAFT: confirm with counsel before relying on this for compliance.
 */
export const WAIVER_RETENTION_YEARS: Record<UsState | "generic", number> = {
  MD: 3,
  PA: 2,
  generic: 3,
};

export function retentionYearsForState(state: UsState | null | undefined): number {
  return WAIVER_RETENTION_YEARS[state ?? "generic"] ?? WAIVER_RETENTION_YEARS.generic;
}

/** Compute the retention deadline (ISO string) for a waiver signed at `signedAt`. */
export function computeRetentionUntil(
  state: UsState | null | undefined,
  signedAt: Date = new Date(),
): string {
  const years = retentionYearsForState(state);
  const until = new Date(signedAt);
  until.setFullYear(until.getFullYear() + years);
  return until.toISOString();
}

/** Human label for the retention rule, shown next to signed waivers in the UI. */
export function retentionLabel(state: UsState | null | undefined): string {
  const years = retentionYearsForState(state);
  if (state === "MD") return `${years} yrs (MD COMAR 10.06.01.06)`;
  if (state === "PA") return `${years} yrs (Philadelphia Dept. of Public Health)`;
  return `${years} yrs (INKD default)`;
}
