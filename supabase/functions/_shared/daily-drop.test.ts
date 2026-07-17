// Offline unit tests for the pure Daily Drop selection algorithm. Zero deps,
// zero IO — runs under Node's built-in runner with type-stripping (Node >= 22):
//   node --test supabase/functions/_shared/daily-drop.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildAffinityLookup,
  buildDropReason,
  deterministicUnit,
  humanizeStyle,
  resolveDropTargets,
  selectDailyDrop,
  type DropCandidate,
  type PriorDrop,
  type StyleAffinity,
} from "./daily-drop.ts";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function post(
  id: string,
  artistId: string,
  styles: string[],
  opts: Partial<DropCandidate> = {},
): DropCandidate {
  return {
    subjectType: "post",
    subjectId: id,
    artistId,
    styles,
    likeCount: 0,
    isAvailable: true,
    createdAt: "2026-07-16T00:00:00Z",
    ...opts,
  };
}
function flash(
  id: string,
  artistId: string,
  styles: string[],
  opts: Partial<DropCandidate> = {},
): DropCandidate {
  return { ...post(id, artistId, styles, opts), subjectType: "flash" };
}

const DATE = "2026-07-16";
const USER = "user-1";

// ---------------------------------------------------------------------------
// affinity lookup
// ---------------------------------------------------------------------------
test("buildAffinityLookup: weight/source/total/size", () => {
  const aff = buildAffinityLookup([
    { slug: "blackwork", weight: 6, source: "follow" },
    { slug: "fineline", weight: 2.5, source: "save" },
  ]);
  assert.equal(aff.weight("blackwork"), 6);
  assert.equal(aff.source("blackwork"), "follow");
  assert.equal(aff.weight("unknown"), 0);
  assert.equal(aff.source("unknown"), undefined);
  assert.equal(aff.total, 8.5);
  assert.equal(aff.size, 2);
});

test("humanizeStyle: slugs → title case words", () => {
  assert.equal(humanizeStyle("black_grey"), "Black Grey");
  assert.equal(humanizeStyle("neo-traditional"), "Neo Traditional");
  assert.equal(humanizeStyle("blackwork"), "Blackwork");
});

test("buildDropReason: source-specific + cold-start copy", () => {
  assert.equal(
    buildDropReason("post", "blackwork", "follow", false),
    "Because you follow artists who work in Blackwork",
  );
  assert.equal(
    buildDropReason("post", "fineline", "save", false),
    "Because you've been saving Fineline work",
  );
  assert.match(buildDropReason("flash", null, undefined, true), /flash drop/i);
  assert.match(buildDropReason("post", null, undefined, true), /trending/i);
});

test("deterministicUnit: stable + in range", () => {
  const a = deterministicUnit("user-1:2026-07-16:post:p1");
  const b = deterministicUnit("user-1:2026-07-16:post:p1");
  assert.equal(a, b);
  assert.ok(a >= 0 && a < 1);
  assert.notEqual(deterministicUnit("a"), deterministicUnit("b"));
});

// ---------------------------------------------------------------------------
// personalization
// ---------------------------------------------------------------------------
test("picks the candidate matching the user's strongest affinity", () => {
  const affinity: StyleAffinity[] = [
    { slug: "blackwork", weight: 9, source: "follow" },
    { slug: "fineline", weight: 2, source: "like" },
  ];
  const candidates = [
    post("p-fine", "art-a", ["fineline"], { likeCount: 3 }),
    post("p-black", "art-b", ["blackwork"], { likeCount: 1 }),
    post("p-color", "art-c", ["color"], { likeCount: 50 }),
  ];
  const sel = selectDailyDrop({ affinity, candidates, priorDrops: [], dropDate: DATE, userId: USER });
  assert.ok(sel);
  assert.equal(sel!.candidate.subjectId, "p-black");
  assert.equal(sel!.reasonStyle, "blackwork");
  assert.equal(sel!.isColdStart, false);
  assert.match(sel!.reason, /follow artists who work in Blackwork/);
});

test("confidence weights the affinity overlap", () => {
  const affinity: StyleAffinity[] = [{ slug: "blackwork", weight: 5, source: "follow" }];
  const strong = post("p-strong", "art-a", ["blackwork"], { styleConfidences: [0.95] });
  const weak = post("p-weak", "art-b", ["blackwork"], { styleConfidences: [0.3] });
  const sel = selectDailyDrop({
    affinity,
    candidates: [weak, strong],
    priorDrops: [],
    dropDate: DATE,
    userId: USER,
  });
  assert.equal(sel!.candidate.subjectId, "p-strong");
});

// ---------------------------------------------------------------------------
// cold start
// ---------------------------------------------------------------------------
test("cold-start: no affinity → still a non-blank pick, ranked by quality", () => {
  const candidates = [
    post("p-lo", "art-a", ["color"], { likeCount: 0 }),
    post("p-hi", "art-b", ["fineline"], { likeCount: 200 }),
  ];
  const sel = selectDailyDrop({ affinity: [], candidates, priorDrops: [], dropDate: DATE, userId: USER });
  assert.ok(sel);
  assert.equal(sel!.isColdStart, true);
  assert.equal(sel!.reasonStyle, null);
  assert.equal(sel!.candidate.subjectId, "p-hi");
  assert.match(sel!.reason, /trending/i);
});

test("cold-start jitter diverges across users on the same day", () => {
  // Many equal-quality candidates → only jitter differentiates. Different users
  // should not all land on the same pick.
  const candidates = Array.from({ length: 12 }, (_, i) => post(`p-${i}`, `art-${i}`, ["color"], { likeCount: 5 }));
  const picks = new Set<string>();
  for (const u of ["u-a", "u-b", "u-c", "u-d", "u-e", "u-f"]) {
    const sel = selectDailyDrop({ affinity: [], candidates, priorDrops: [], dropDate: DATE, userId: u });
    picks.add(sel!.candidate.subjectId);
  }
  assert.ok(picks.size > 1, "expected different users to get different cold-start picks");
});

// ---------------------------------------------------------------------------
// no-repeat + variety
// ---------------------------------------------------------------------------
test("never re-picks a subject already dropped to the user", () => {
  const affinity: StyleAffinity[] = [{ slug: "blackwork", weight: 9, source: "follow" }];
  const candidates = [
    post("p-black", "art-b", ["blackwork"]),
    post("p-black2", "art-c", ["blackwork"]),
  ];
  const priorDrops: PriorDrop[] = [
    { subjectType: "post", subjectId: "p-black", artistId: "art-b", reasonStyle: "blackwork", dropDate: "2026-07-10" },
  ];
  const sel = selectDailyDrop({ affinity, candidates, priorDrops, dropDate: DATE, userId: USER });
  assert.equal(sel!.candidate.subjectId, "p-black2");
});

test("penalizes yesterday's artist so the drop rotates", () => {
  const affinity: StyleAffinity[] = [{ slug: "blackwork", weight: 6, source: "follow" }];
  // Two equally-matched candidates; one is yesterday's artist.
  const candidates = [
    post("p-y", "art-yesterday", ["blackwork"]),
    post("p-new", "art-fresh", ["blackwork"]),
  ];
  const priorDrops: PriorDrop[] = [
    { subjectType: "post", subjectId: "p-old", artistId: "art-yesterday", reasonStyle: "blackwork", dropDate: "2026-07-15" },
  ];
  const sel = selectDailyDrop({ affinity, candidates, priorDrops, dropDate: DATE, userId: USER });
  assert.equal(sel!.candidate.artistId, "art-fresh");
});

test("flash/original mix: after a post yesterday, an equal flash today wins", () => {
  const affinity: StyleAffinity[] = [{ slug: "blackwork", weight: 6, source: "follow" }];
  const candidates = [
    post("p-today", "art-a", ["blackwork"]),
    flash("f-today", "art-b", ["blackwork"]),
  ];
  const priorDrops: PriorDrop[] = [
    { subjectType: "post", subjectId: "p-yest", artistId: "art-z", reasonStyle: "blackwork", dropDate: "2026-07-15" },
  ];
  const sel = selectDailyDrop({ affinity, candidates, priorDrops, dropDate: DATE, userId: USER });
  assert.equal(sel!.candidate.subjectType, "flash");
});

test("mix preference never forces a strictly worse pick", () => {
  // Yesterday was a post → flash preferred, but the only flash has no affinity
  // and low quality while a post is a strong affinity match: the post still wins.
  const affinity: StyleAffinity[] = [{ slug: "blackwork", weight: 20, source: "follow" }];
  const candidates = [
    post("p-strong", "art-a", ["blackwork"], { likeCount: 30 }),
    flash("f-weak", "art-b", ["color"], { likeCount: 0 }),
  ];
  const priorDrops: PriorDrop[] = [
    { subjectType: "post", subjectId: "p-yest", artistId: "art-z", reasonStyle: "color", dropDate: "2026-07-15" },
  ];
  const sel = selectDailyDrop({ affinity, candidates, priorDrops, dropDate: DATE, userId: USER });
  assert.equal(sel!.candidate.subjectId, "p-strong");
});

// ---------------------------------------------------------------------------
// determinism + edge cases
// ---------------------------------------------------------------------------
test("deterministic: identical inputs → identical pick (idempotent selection)", () => {
  const affinity: StyleAffinity[] = [{ slug: "fineline", weight: 4, source: "save" }];
  const candidates = [
    post("p1", "art-a", ["fineline"], { likeCount: 10 }),
    post("p2", "art-b", ["fineline"], { likeCount: 10 }),
    flash("f1", "art-c", ["fineline"]),
  ];
  const args = { affinity, candidates, priorDrops: [] as PriorDrop[], dropDate: DATE, userId: USER };
  const a = selectDailyDrop(args);
  const b = selectDailyDrop(args);
  assert.equal(a!.candidate.subjectId, b!.candidate.subjectId);
  assert.equal(a!.score, b!.score);
});

test("similar_works similarity boosts a candidate", () => {
  const candidates = [
    post("p-plain", "art-a", ["color"], { likeCount: 2 }),
    post("p-similar", "art-b", ["color"], { likeCount: 2, similarity: 0.9 }),
  ];
  const sel = selectDailyDrop({ affinity: [], candidates, priorDrops: [], dropDate: DATE, userId: USER });
  assert.equal(sel!.candidate.subjectId, "p-similar");
});

test("returns null when nothing is eligible", () => {
  const candidates = [post("p1", "art-a", ["color"], { isAvailable: false })];
  const sel = selectDailyDrop({ affinity: [], candidates, priorDrops: [], dropDate: DATE, userId: USER });
  assert.equal(sel, null);
});

test("excludes the user's own artist work", () => {
  const candidates = [
    post("p-mine", "art-me", ["blackwork"], { likeCount: 99 }),
    post("p-other", "art-other", ["blackwork"], { likeCount: 1 }),
  ];
  const sel = selectDailyDrop({
    affinity: [{ slug: "blackwork", weight: 5, source: "follow" }],
    candidates,
    priorDrops: [],
    dropDate: DATE,
    userId: USER,
    excludeArtistId: "art-me",
  });
  assert.equal(sel!.candidate.subjectId, "p-other");
});

// ---------------------------------------------------------------------------
// On-demand ("self" mode) target resolution — the safety + idempotency contract
// of the app-triggered daily-drop generation (resolveDropTargets).
// ---------------------------------------------------------------------------
test("resolveDropTargets: self mode pins the caller + today, ignoring body", () => {
  const plan = resolveDropTargets({
    runner: false,
    selfUserId: "user-me",
    // A malicious/confused caller tries to target someone else + backfill a date:
    body: { user_id: "user-someone-else", drop_date: "2020-01-01", batch_size: 999 },
    today: "2026-07-17",
  });
  assert.equal(plan.scope, "self");
  assert.equal(plan.userId, "user-me"); // NOT the body's user_id
  assert.equal(plan.dropDate, "2026-07-17"); // NOT the body's drop_date
  assert.equal(plan.batchSize, 1);
});

test("resolveDropTargets: self mode requires an authenticated user", () => {
  assert.throws(() =>
    resolveDropTargets({ runner: false, selfUserId: null, body: {}, today: "2026-07-17" }),
  );
});

test("resolveDropTargets: two self calls resolve to the SAME (user, day) — idempotent target", () => {
  const a = resolveDropTargets({ runner: false, selfUserId: "u1", body: {}, today: "2026-07-17" });
  const b = resolveDropTargets({ runner: false, selfUserId: "u1", body: {}, today: "2026-07-17" });
  assert.deepEqual(a, b); // same target both times → the unique(user,day) index makes the 2nd a no-op
});

test("resolveDropTargets: runner may target a single named user", () => {
  const plan = resolveDropTargets({
    runner: true,
    selfUserId: null,
    body: { user_id: "u9", drop_date: "2026-07-10" },
    today: "2026-07-17",
  });
  assert.equal(plan.scope, "single");
  assert.equal(plan.userId, "u9");
  assert.equal(plan.dropDate, "2026-07-10");
});

test("resolveDropTargets: runner default is the paged all-users sweep (the cron)", () => {
  const plan = resolveDropTargets({
    runner: true,
    selfUserId: null,
    body: { batch_size: 50, offset: 100 },
    today: "2026-07-17",
  });
  assert.equal(plan.scope, "all");
  assert.equal(plan.batchSize, 50);
  assert.equal(plan.offset, 100);
  assert.equal(plan.dropDate, "2026-07-17");
});
