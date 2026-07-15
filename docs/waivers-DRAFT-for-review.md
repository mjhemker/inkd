# Waiver templates — DRAFT, pending legal review

**Status: DRAFT — PENDING LEGAL REVIEW. Nothing on this page is legal advice.
Do not let a pilot artist rely on these templates in production until an
attorney licensed in Maryland and Pennsylvania has reviewed them.**

This doc is for Michael. It explains what was drafted, where the language
came from, and what still needs a lawyer's eyes before the Baltimore/Philly
pilot goes live (SPEC §0: "Waivers/consent: target MD + PA compliance
first").

Three global waiver templates were seeded into `waiver_templates`
(`artist_id IS NULL`, so every artist can see and pick them — SPEC §2):

1. **Maryland** — `state = 'MD'`
2. **Pennsylvania** — `state = 'PA'`
3. **Generic fallback** — `state = NULL`, used when INKD can't determine a
   booking's jurisdiction (e.g. the artist hasn't set a studio location yet)

Seeded via migration `supabase/migrations/20260715120000_seed_waiver_templates.sql`
(applied to the `khlpidflnvkqafkvkpfy` project). Every template's `title`
carries a `(DRAFT — pending legal review)` suffix and the body opens with a
`*** DRAFT — PENDING LEGAL REVIEW ***` banner, so the marker survives into
the rendered document a client actually signs — remove both only after
counsel signs off.

## What each template covers

Per the build spec, every template includes all seven of these sections, plus
an eighth retention-disclosure paragraph:

1. Client identity + photo-ID attestation
2. Age 18+ attestation
3. Medical history & disclosure
4. Procedure description + placement
5. Aftercare acknowledgment
6. Photography/portfolio consent — **the only optional section**, rendered as
   a separate, non-required checkbox in the signing flow
7. Assumption of risk & release of liability
8. Record retention disclosure (see retention windows below)

The body text uses `{{token}}` placeholders (`artist_name`, `studio_name`,
`studio_address`, `client_name`, `procedure_description`, `placement`,
`session_date`, `date`) that the client signing flow fills in from the
booking at render time (`packages/core/src/waivers/render.ts`). The exact
rendered text — after substitution — is frozen into
`signed_waivers.content_snapshot` at signing, so what a client agreed to can
never drift even if the artist edits their template later.

## Policy decision baked into all three: 18+ only, no minors

Both Maryland and Pennsylvania regulatory schemes contemplate a minor getting
tattooed with a parent/guardian's consent (and, in Pennsylvania, the
parent/guardian's physical presence — 18 Pa.C.S. § 6311). **INKD's templates
do not offer that path.** All three require the client to attest they are 18
or older, full stop. This is a product/business decision to reduce legal
complexity for a 20–50-artist pilot, not a legal requirement — flag if you
want this revisited (e.g. to support parental-consent minors in MD/PA
separately, or to leave it as permanent platform policy).

## Sourcing (what was actually pulled from, and its limits)

**Maryland**
- [COMAR 10.06.01.06](https://regs.maryland.gov/us/md/exec/comar/10.06.01.06)
  — the operative regulation for "skin-penetrating body adornment
  procedures." Confirmed: written consent required before the procedure;
  risks must be disclosed; records (client name, date, procedure type,
  technician) retained **3 years**; minors require parental/guardian consent
  (COMAR text pulled via a fetched mirror doesn't spell out an exact minimum
  age floor below which even parental consent can't cure it — worth
  confirming directly against the regulations.gov COMAR text or a Maryland
  attorney, especially since Baltimore City's own tattoo licensing chapter
  may impose stricter local rules).
- [Maryland Dept. of Health — Tattooing](https://health.maryland.gov/phpa/OEHFP/EH/Pages/Tattooing.aspx)
  — clarifies MDH does **not** license tattoo/piercing businesses; local
  health departments (Baltimore City, Allegany County, Calvert County,
  Worcester County, etc.) do. The template cites COMAR because it's the
  state-level baseline, but a Baltimore City–specific consent/recordkeeping
  form may also be required locally — the fetched Baltimore City tattoo-code
  PDF returned no extractable text during this research pass, so that gap is
  still open.

**Pennsylvania**
- [18 Pa.C.S. § 6311](https://law.justia.com/codes/pennsylvania/title-18/chapter-63/section-6311/)
  — state-level criminal statute: tattooing or body-piercing (for
  compensation) a person under 18 without a present, consenting
  parent/guardian is a misdemeanor. This is the basis for the "18+ only, no
  exceptions" policy above — INKD's rule is stricter than the statute, not
  looser.
- [Philadelphia Dept. of Public Health — Body Art Regulations (PDF)](https://www.phila.gov/media/20181004140627/Body_Art_Regulations.pdf)
  — Pennsylvania has **no statewide body-art licensing regime**; Philadelphia
  regulates locally. Confirmed: written + verbal aftercare instructions
  required, naming the establishment; specific pre-procedure health-condition
  advisories (skin disease/cancer history at the site, known allergies to
  pigments/dyes/cleaning solutions, anticoagulant use or bleeding disorders,
  diabetes/immune conditions, keloid history); records (customer name, date,
  time, procedure/piercing identification, operator name) retained
  **2 years**; age tiers of 16–17 (written parental consent + in-person +
  photo ID) and under-16 (prohibited absent a physician's statement) — both
  superseded here by INKD's 18+-only policy.
- **Gap:** the Pennsylvania template is Philadelphia-shaped because that's
  Jayden's network (SPEC §0). If/when the pilot expands to PA artists outside
  Philadelphia, their local health department's rules (which may differ from
  Philadelphia's) haven't been researched and the template should be revisited.

## Retention windows

Implemented in `packages/core/src/waivers/render.ts`
(`WAIVER_RETENTION_YEARS`, `computeRetentionUntil`), and shown to artists next
to each signed waiver on `/settings/waivers`:

| Jurisdiction | Retention | Source |
|---|---|---|
| Maryland | 3 years from signing | COMAR 10.06.01.06 |
| Pennsylvania (Philadelphia) | 2 years from signing | Philadelphia Dept. of Public Health body-art regs |
| Generic / unresolved | 3 years from signing | INKD default — the longer of the two known windows, so we never under-retain when a booking's jurisdiction can't be determined |

`signed_waivers.retention_until` is computed and stored at signing time
(`signed_at + N years`) and is purely informational in the UI today — nothing
auto-deletes a signed waiver at that date (the table's `signed_waivers`
migration makes rows immutable/undeletable by trigger + RLS by design, so any
future retention-expiry handling should be a deliberate, audited process, not
an app-level delete).

## E-signature validity

Typed-name and drawn-canvas signatures are both captured as electronic
signatures under the federal ESIGN Act and the Uniform Electronic
Transactions Act (adopted in both MD and PA) — a drawn signature is not
required for legal validity as long as intent to sign, consent to do
business electronically, and a retained/reproducible record are present.
`signed_waivers` captures signer name, signature type/data, IP address, user
agent, and timestamp to support that record. This reasoning is not
attorney-verified; flag if you want an explicit ESIGN/UETA compliance review
before pilot.

## Open questions for legal review

1. Confirm the exact Maryland minimum-age floor (if any) below which even
   parental consent cannot authorize a tattoo, and whether Baltimore City's
   local tattoo ordinance imposes anything beyond COMAR 10.06.01.06.
2. Confirm whether a Baltimore City–specific consent/recordkeeping form is
   required in addition to (or instead of) COMAR-level consent.
3. Confirm the liability-release language is enforceable as drafted in both
   MD and PA (some states limit release-of-liability clauses for gross
   negligence/recklessness differently — the templates already carve out
   "gross negligence or willful misconduct," but that carve-out should be
   reviewed, not assumed sufficient).
4. Decide whether INKD's stricter-than-law "18+, no parental-consent minors"
   policy should be a permanent platform rule or configurable per artist.
5. If/when PA artists outside Philadelphia join the pilot, source their local
   health department's body-art rules (retention window, consent form
   requirements) — do not assume Philadelphia's rules apply statewide.
6. Confirm the photography/portfolio consent checkbox's language satisfies
   any state-specific right-of-publicity or model-release norms beyond
   generic consent (not deeply researched here — treated as a standard
   opt-in, not a state-regulated form).

## Where the templates actually live

- Seed data / exact signed text: `supabase/migrations/20260715120000_seed_waiver_templates.sql`
  (also applied live to the `khlpidflnvkqafkvkpfy` Supabase project)
- Rendering + retention logic: `packages/core/src/waivers/render.ts`
- Artist template management UI: `/settings/waivers` (web), `/waivers` (mobile)
- Client signing flow: `/waivers/sign/[bookingId]` (web + mobile)

Full body text for all three templates is in the migration file linked
above — reading it there guarantees you're reading exactly what a client
would see, since the signing flow renders that same `body` column verbatim
(with placeholders filled in).
