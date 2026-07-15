-- Migration: seed_waiver_templates
-- Seeds three INKD-global waiver templates (artist_id IS NULL, so every
-- artist sees them per the waiver_templates_select RLS policy): Maryland,
-- Pennsylvania, and a state-generic fallback.
--
-- *** DRAFT — PENDING LEGAL REVIEW ***
-- This copy is a starting point drafted from public regulatory sources, not
-- attorney-reviewed legal advice. See docs/waivers-DRAFT-for-review.md for
-- sourcing, retention-window rationale, and open questions for counsel before
-- any artist relies on these in production. Do not remove the "DRAFT" marker
-- from `title` or the in-body notice until that review is complete.
--
-- required_fields drives the checkbox list the client signing flow renders
-- (packages/core/src/waivers/render.ts#parseRequiredFields). Keys are shared
-- across all three templates so the signing UI logic doesn't branch on state.
-- `photo_consent` is the only optional (non-required) acknowledgment, per
-- SPEC's "photography/portfolio consent (optional checkbox)".
--
-- Body placeholders ({{token}}) are substituted at render time with booking
-- context (artist_name, studio_name, studio_address, client_name,
-- procedure_description, placement, session_date, date) — see
-- packages/core/src/waivers/render.ts#renderWaiverBody.

-- ===========================================================================
-- Maryland
-- ===========================================================================
insert into public.waiver_templates (artist_id, title, body, state, version, is_active, required_fields)
values (
  null,
  'INKD Standard Consent & Release — Maryland (DRAFT — pending legal review)',
  $md_body$*** DRAFT — PENDING LEGAL REVIEW. Not legal advice. Do not rely on this document until it has been reviewed by counsel. ***

TATTOO INFORMED CONSENT, MEDICAL DISCLOSURE & RELEASE OF LIABILITY
State of Maryland

Studio / Artist: {{artist_name}}, {{studio_name}}
Location: {{studio_address}}
Client: {{client_name}}
Date: {{date}}
Scheduled session: {{session_date}}

This document is prepared to support compliance with the Code of Maryland Regulations (COMAR) 10.06.01, governing skin-penetrating body adornment procedures, and reflects local requirements observed in Baltimore City and surrounding Maryland jurisdictions. It does not replace local health department forms your studio may also be required to keep.

1. CLIENT IDENTITY & PHOTO-ID ATTESTATION
I attest that I have presented {{artist_name}} with valid, unexpired, government-issued photo identification confirming my legal name and date of birth. I understand a copy or record of this identification may be retained with my client file as required by Maryland regulation and this studio's recordkeeping policy.

2. AGE ATTESTATION (18+)
I attest that I am at least eighteen (18) years of age. I understand that {{studio_name}} does not tattoo minors under any circumstances, including with parental or guardian consent, as a matter of studio and INKD platform policy.

3. MEDICAL HISTORY & DISCLOSURE
I have fully and truthfully disclosed to {{artist_name}} all medical conditions, allergies (including to latex, pigments, dyes, adhesives, or topical anesthetics), skin conditions (including keloid scarring history, psoriasis, eczema, or active rash/lesion at the intended site), bleeding disorders, use of blood thinners or anticoagulant medication, diabetes, immune deficiencies or immunosuppressive therapy, pregnancy or nursing status, and any other condition that could affect the safety of this procedure or my healing. I understand undisclosed conditions may increase the risk of infection, adverse reaction, or poor healing, and that {{artist_name}} is relying on my disclosure being complete and accurate.

4. PROCEDURE DESCRIPTION & PLACEMENT
I have discussed and approved the following with {{artist_name}}: procedure — {{procedure_description}}; placement — {{placement}}. I understand tattooing is a permanent alteration of the skin performed by penetrating the skin with needles to deposit pigment, that minor variations from any reference image are normal, that colors may fade or shift over time and with sun exposure, and that touch-ups may be needed and may not be included in the original price. I have had the opportunity to ask questions and had them answered to my satisfaction before this session begins.

5. AFTERCARE ACKNOWLEDGMENT
I have received written aftercare instructions from {{artist_name}} covering cleaning, moisturizing, sun protection, activity restrictions, and signs of infection requiring medical attention. I understand and agree to follow these instructions, and that failure to do so may affect healing and appearance and is not the responsibility of {{artist_name}} or INKD.

6. PHOTOGRAPHY / PORTFOLIO CONSENT (OPTIONAL)
Separately from the required sections above, I may consent below to {{artist_name}} and INKD photographing my tattoo (healed and/or fresh) for use in the artist's portfolio, INKD's platform, and related marketing or social media. This consent is optional and declining it will not affect the service I receive.

7. ASSUMPTION OF RISK & RELEASE OF LIABILITY
I understand that tattooing carries inherent risks including but not limited to infection, allergic reaction, scarring, pigment migration, and dissatisfaction with the finished result despite reasonable care. In consideration of {{artist_name}} performing this procedure, I voluntarily assume these risks and release {{artist_name}}, {{studio_name}}, and INKD (the platform facilitating this booking) from liability for claims arising from the procedure, except to the extent caused by gross negligence or willful misconduct. This release does not waive any right that cannot be waived under Maryland law.

8. RECORD RETENTION
I understand this signed record, including the exact text I am agreeing to, my e-signature, and the date/time of signing, will be retained by {{studio_name}} for at least three (3) years from the date of signing, consistent with COMAR 10.06.01.06 recordkeeping requirements, and may be produced to a Maryland health officer upon request.

By checking the boxes below and signing with my full legal name, I acknowledge that I have read (or had read to me), understood, and agree to every section above that is marked required, and that my electronic signature is legally binding to the same extent as a handwritten signature.$md_body$,
  'MD',
  1,
  true,
  '[
    {"key": "identity_id", "label": "I attest that the photo ID I presented is genuine, unexpired, and belongs to me.", "required": true},
    {"key": "age_18", "label": "I attest that I am at least 18 years of age.", "required": true},
    {"key": "medical_disclosure", "label": "I have fully and truthfully disclosed my relevant medical history, allergies, and conditions.", "required": true},
    {"key": "procedure_understood", "label": "I have reviewed and understand the procedure description and placement, and have had my questions answered.", "required": true},
    {"key": "aftercare_ack", "label": "I have received and understand the written aftercare instructions and agree to follow them.", "required": true},
    {"key": "liability_release", "label": "I have read and agree to the assumption of risk and release of liability.", "required": true},
    {"key": "photo_consent", "label": "Optional: I consent to my tattoo being photographed for portfolio and marketing use.", "required": false}
  ]'::jsonb
);

-- ===========================================================================
-- Pennsylvania
-- ===========================================================================
insert into public.waiver_templates (artist_id, title, body, state, version, is_active, required_fields)
values (
  null,
  'INKD Standard Consent & Release — Pennsylvania (DRAFT — pending legal review)',
  $pa_body$*** DRAFT — PENDING LEGAL REVIEW. Not legal advice. Do not rely on this document until it has been reviewed by counsel. ***

TATTOO INFORMED CONSENT, MEDICAL DISCLOSURE & RELEASE OF LIABILITY
Commonwealth of Pennsylvania

Studio / Artist: {{artist_name}}, {{studio_name}}
Location: {{studio_address}}
Client: {{client_name}}
Date: {{date}}
Scheduled session: {{session_date}}

Pennsylvania does not license tattoo establishments at the state level; local health departments regulate the practice. This document is prepared with reference to the City of Philadelphia Department of Public Health's body art regulations and 18 Pa.C.S. § 6311 (tattooing/body piercing of minors). Studios operating outside Philadelphia should confirm any additional local requirements.

1. CLIENT IDENTITY & PHOTO-ID ATTESTATION
I attest that I have presented {{artist_name}} with valid, unexpired, government-issued photo identification confirming my legal name and date of birth, consistent with Philadelphia Department of Public Health recordkeeping requirements (customer name, date, time, and procedure identification).

2. AGE ATTESTATION (18+)
I attest that I am at least eighteen (18) years of age. I understand Pennsylvania law (18 Pa.C.S. § 6311) restricts tattooing of persons under 18 even with parental consent and presence, and that as a matter of studio and INKD platform policy, {{studio_name}} does not tattoo minors under any circumstances.

3. MEDICAL HISTORY & DISCLOSURE
I have fully and truthfully disclosed to {{artist_name}} all medical conditions, allergies (including to latex, pigments, dyes, adhesives, or topical anesthetics), skin conditions (including keloid scarring history, psoriasis, eczema, or active rash/lesion at the intended site), bleeding disorders, use of blood thinners or anticoagulant medication, diabetes, immune deficiencies or immunosuppressive therapy, pregnancy or nursing status, and any other condition that could affect the safety of this procedure or my healing. I understand undisclosed conditions may increase the risk of infection, adverse reaction, or poor healing, and that {{artist_name}} is relying on my disclosure being complete and accurate.

4. PROCEDURE DESCRIPTION & PLACEMENT
I have discussed and approved the following with {{artist_name}}: procedure — {{procedure_description}}; placement — {{placement}}. I understand tattooing is a permanent alteration of the skin performed by penetrating the skin with needles to deposit pigment, that minor variations from any reference image are normal, that colors may fade or shift over time and with sun exposure, and that touch-ups may be needed and may not be included in the original price. I have had the opportunity to ask questions and had them answered to my satisfaction before this session begins.

5. AFTERCARE ACKNOWLEDGMENT
I have received written aftercare instructions from {{artist_name}}, consistent with Philadelphia body art regulations requiring verbal and written care instructions naming the establishment and advising prompt medical attention at the first sign of infection. I understand and agree to follow these instructions, and that failure to do so may affect healing and appearance and is not the responsibility of {{artist_name}} or INKD.

6. PHOTOGRAPHY / PORTFOLIO CONSENT (OPTIONAL)
Separately from the required sections above, I may consent below to {{artist_name}} and INKD photographing my tattoo (healed and/or fresh) for use in the artist's portfolio, INKD's platform, and related marketing or social media. This consent is optional and declining it will not affect the service I receive.

7. ASSUMPTION OF RISK & RELEASE OF LIABILITY
I understand that tattooing carries inherent risks including but not limited to infection, allergic reaction, scarring, pigment migration, and dissatisfaction with the finished result despite reasonable care. In consideration of {{artist_name}} performing this procedure, I voluntarily assume these risks and release {{artist_name}}, {{studio_name}}, and INKD (the platform facilitating this booking) from liability for claims arising from the procedure, except to the extent caused by gross negligence or willful misconduct. This release does not waive any right that cannot be waived under Pennsylvania law.

8. RECORD RETENTION
I understand this signed record, including the exact text I am agreeing to, my e-signature, and the date/time of signing, will be retained by {{studio_name}} for at least two (2) years from the date of signing, consistent with Philadelphia Department of Public Health body art recordkeeping requirements, and may be produced to the Department upon request. Studios outside Philadelphia should confirm their local retention period.

By checking the boxes below and signing with my full legal name, I acknowledge that I have read (or had read to me), understood, and agree to every section above that is marked required, and that my electronic signature is legally binding to the same extent as a handwritten signature.$pa_body$,
  'PA',
  1,
  true,
  '[
    {"key": "identity_id", "label": "I attest that the photo ID I presented is genuine, unexpired, and belongs to me.", "required": true},
    {"key": "age_18", "label": "I attest that I am at least 18 years of age.", "required": true},
    {"key": "medical_disclosure", "label": "I have fully and truthfully disclosed my relevant medical history, allergies, and conditions.", "required": true},
    {"key": "procedure_understood", "label": "I have reviewed and understand the procedure description and placement, and have had my questions answered.", "required": true},
    {"key": "aftercare_ack", "label": "I have received and understand the written aftercare instructions and agree to follow them.", "required": true},
    {"key": "liability_release", "label": "I have read and agree to the assumption of risk and release of liability.", "required": true},
    {"key": "photo_consent", "label": "Optional: I consent to my tattoo being photographed for portfolio and marketing use.", "required": false}
  ]'::jsonb
);

-- ===========================================================================
-- Generic fallback (state not resolvable from the booking's location)
-- ===========================================================================
insert into public.waiver_templates (artist_id, title, body, state, version, is_active, required_fields)
values (
  null,
  'INKD Standard Consent & Release — Generic (DRAFT — pending legal review)',
  $generic_body$*** DRAFT — PENDING LEGAL REVIEW. Not legal advice. Do not rely on this document until it has been reviewed by counsel. ***

TATTOO INFORMED CONSENT, MEDICAL DISCLOSURE & RELEASE OF LIABILITY

Studio / Artist: {{artist_name}}, {{studio_name}}
Location: {{studio_address}}
Client: {{client_name}}
Date: {{date}}
Scheduled session: {{session_date}}

This is INKD's state-generic consent template, used when a booking's jurisdiction could not be automatically determined (e.g. no studio location on file). It reflects common requirements across Maryland and Pennsylvania body-art regulations but is not tailored to either. Artists should add or select a state-specific template (Maryland or Pennsylvania) whenever the client's session location is known.

1. CLIENT IDENTITY & PHOTO-ID ATTESTATION
I attest that I have presented {{artist_name}} with valid, unexpired, government-issued photo identification confirming my legal name and date of birth. I understand a copy or record of this identification may be retained with my client file as required by applicable law and this studio's recordkeeping policy.

2. AGE ATTESTATION (18+)
I attest that I am at least eighteen (18) years of age. I understand {{studio_name}} does not tattoo minors under any circumstances, including with parental or guardian consent, as a matter of studio and INKD platform policy.

3. MEDICAL HISTORY & DISCLOSURE
I have fully and truthfully disclosed to {{artist_name}} all medical conditions, allergies (including to latex, pigments, dyes, adhesives, or topical anesthetics), skin conditions (including keloid scarring history, psoriasis, eczema, or active rash/lesion at the intended site), bleeding disorders, use of blood thinners or anticoagulant medication, diabetes, immune deficiencies or immunosuppressive therapy, pregnancy or nursing status, and any other condition that could affect the safety of this procedure or my healing. I understand undisclosed conditions may increase the risk of infection, adverse reaction, or poor healing, and that {{artist_name}} is relying on my disclosure being complete and accurate.

4. PROCEDURE DESCRIPTION & PLACEMENT
I have discussed and approved the following with {{artist_name}}: procedure — {{procedure_description}}; placement — {{placement}}. I understand tattooing is a permanent alteration of the skin performed by penetrating the skin with needles to deposit pigment, that minor variations from any reference image are normal, that colors may fade or shift over time and with sun exposure, and that touch-ups may be needed and may not be included in the original price. I have had the opportunity to ask questions and had them answered to my satisfaction before this session begins.

5. AFTERCARE ACKNOWLEDGMENT
I have received written aftercare instructions from {{artist_name}} covering cleaning, moisturizing, sun protection, activity restrictions, and signs of infection requiring medical attention. I understand and agree to follow these instructions, and that failure to do so may affect healing and appearance and is not the responsibility of {{artist_name}} or INKD.

6. PHOTOGRAPHY / PORTFOLIO CONSENT (OPTIONAL)
Separately from the required sections above, I may consent below to {{artist_name}} and INKD photographing my tattoo (healed and/or fresh) for use in the artist's portfolio, INKD's platform, and related marketing or social media. This consent is optional and declining it will not affect the service I receive.

7. ASSUMPTION OF RISK & RELEASE OF LIABILITY
I understand that tattooing carries inherent risks including but not limited to infection, allergic reaction, scarring, pigment migration, and dissatisfaction with the finished result despite reasonable care. In consideration of {{artist_name}} performing this procedure, I voluntarily assume these risks and release {{artist_name}}, {{studio_name}}, and INKD (the platform facilitating this booking) from liability for claims arising from the procedure, except to the extent caused by gross negligence or willful misconduct.

8. RECORD RETENTION
I understand this signed record, including the exact text I am agreeing to, my e-signature, and the date/time of signing, will be retained by {{studio_name}} for at least three (3) years from the date of signing (INKD's conservative default pending confirmation of the applicable jurisdiction), and may be produced to a health authority upon request.

By checking the boxes below and signing with my full legal name, I acknowledge that I have read (or had read to me), understood, and agree to every section above that is marked required, and that my electronic signature is legally binding to the same extent as a handwritten signature.$generic_body$,
  null,
  1,
  true,
  '[
    {"key": "identity_id", "label": "I attest that the photo ID I presented is genuine, unexpired, and belongs to me.", "required": true},
    {"key": "age_18", "label": "I attest that I am at least 18 years of age.", "required": true},
    {"key": "medical_disclosure", "label": "I have fully and truthfully disclosed my relevant medical history, allergies, and conditions.", "required": true},
    {"key": "procedure_understood", "label": "I have reviewed and understand the procedure description and placement, and have had my questions answered.", "required": true},
    {"key": "aftercare_ack", "label": "I have received and understand the written aftercare instructions and agree to follow them.", "required": true},
    {"key": "liability_release", "label": "I have read and agree to the assumption of risk and release of liability.", "required": true},
    {"key": "photo_consent", "label": "Optional: I consent to my tattoo being photographed for portfolio and marketing use.", "required": false}
  ]'::jsonb
);
