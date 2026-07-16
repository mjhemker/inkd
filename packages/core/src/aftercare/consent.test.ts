// Offline unit tests for the aftercare consent / healed-photo share state
// machine. This is the safety net for the founder's hard rule: a healed photo
// only ever becomes public after EXPLICIT client opt-in — consent defaults OFF
// and is meaningless without a photo.
//   node --test packages/core/src/aftercare/consent.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveShareState,
  canShareHealedPhoto,
  isHealedPhotoShared,
  sanitizeConsent,
  buildResponsePatch,
  shouldNudgeReview,
  type AftercareCheckinState,
} from "./consent.ts";

function state(p: Partial<AftercareCheckinState>): AftercareCheckinState {
  return {
    status: "responded",
    photo_path: null,
    consent_to_share: false,
    shared_as_portfolio_piece_id: null,
    ...p,
  };
}

test("deriveShareState covers the full matrix", () => {
  assert.equal(deriveShareState(state({ status: "pending" })), "not_responded");
  assert.equal(deriveShareState(state({ status: "sent" })), "not_responded");
  assert.equal(deriveShareState(state({ status: "responded", photo_path: null })), "no_photo");
  assert.equal(
    deriveShareState(state({ photo_path: "c/1/p.jpg", consent_to_share: false })),
    "photo_private",
  );
  assert.equal(
    deriveShareState(state({ photo_path: "c/1/p.jpg", consent_to_share: true })),
    "share_ready",
  );
  assert.equal(
    deriveShareState(
      state({ photo_path: "c/1/p.jpg", consent_to_share: true, shared_as_portfolio_piece_id: "pp1" }),
    ),
    "shared",
  );
});

test("canShareHealedPhoto only when photo + consent + responded + not-yet-shared", () => {
  assert.equal(canShareHealedPhoto(state({ photo_path: "c/1/p.jpg", consent_to_share: true })), true);
  // consent OFF -> cannot share (the default, opt-in rule)
  assert.equal(canShareHealedPhoto(state({ photo_path: "c/1/p.jpg", consent_to_share: false })), false);
  // no photo -> cannot share
  assert.equal(canShareHealedPhoto(state({ photo_path: null, consent_to_share: true })), false);
  // not responded -> cannot share
  assert.equal(
    canShareHealedPhoto(state({ status: "sent", photo_path: "c/1/p.jpg", consent_to_share: true })),
    false,
  );
  // already shared -> cannot re-share
  assert.equal(
    canShareHealedPhoto(
      state({ photo_path: "c/1/p.jpg", consent_to_share: true, shared_as_portfolio_piece_id: "pp1" }),
    ),
    false,
  );
});

test("isHealedPhotoShared reflects the portfolio link", () => {
  assert.equal(isHealedPhotoShared(state({})), false);
  assert.equal(isHealedPhotoShared(state({ shared_as_portfolio_piece_id: "pp1" })), true);
});

test("sanitizeConsent clamps consent to false without a photo", () => {
  assert.equal(sanitizeConsent(true, true), true);
  assert.equal(sanitizeConsent(true, false), false); // consent on, no photo -> false
  assert.equal(sanitizeConsent(false, true), false);
  assert.equal(sanitizeConsent(undefined, true), false);
});

test("buildResponsePatch: consent survives with a photo, clamped without, rating clamped 1..5", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");

  const withPhoto = buildResponsePatch(
    { healing_rating: 4, note: "  peeling a bit ", photo_path: "c/1/p.jpg", consent_to_share: true },
    now,
  );
  assert.deepEqual(withPhoto, {
    status: "responded",
    responded_at: "2026-07-20T12:00:00.000Z",
    healing_rating: 4,
    note: "peeling a bit",
    photo_path: "c/1/p.jpg",
    consent_to_share: true,
  });

  // consent on but NO photo -> clamped to false
  const noPhoto = buildResponsePatch({ consent_to_share: true, photo_path: null }, now);
  assert.equal(noPhoto.consent_to_share, false);
  assert.equal(noPhoto.photo_path, null);
  assert.equal(noPhoto.note, null);
  assert.equal(noPhoto.healing_rating, null);

  // rating clamps
  assert.equal(buildResponsePatch({ healing_rating: 9 }, now).healing_rating, 5);
  assert.equal(buildResponsePatch({ healing_rating: 0 }, now).healing_rating, 1);
  assert.equal(buildResponsePatch({ healing_rating: 3.6 }, now).healing_rating, 4);
});

test("shouldNudgeReview only at week_3 and only when unreviewed", () => {
  assert.equal(shouldNudgeReview("week_3", false), true);
  assert.equal(shouldNudgeReview("week_3", true), false);
  assert.equal(shouldNudgeReview("day_3", false), false);
  assert.equal(shouldNudgeReview("week_1", false), false);
});
