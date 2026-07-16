// Offline unit tests for the shop membership STATE MACHINE + promotional-vs-
// managed CAPABILITY MATRIX. Runs under Node's built-in runner with
// type-stripping (Node >= 22.6):
//   node --test packages/core/src/domain/shops.test.ts
//
// These pin the rules that the SQL guard + RLS enforce authoritatively
// (migration 20260717080000_shops.sql), so the client mirror can never drift
// into offering a transition the database will reject:
//   invite -> accept -> active; promotional vs managed capability gating;
//   only managers change role/mode; members can only accept/decline/leave.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canEditMemberRoleOrMode,
  canPerformMembershipAction,
  canTransitionMemberStatus,
  shopCanViewMemberAgenda,
  shopMemberCapabilities,
  statusAfterAction,
} from "./shops.ts";

// ---------------------------------------------------------------------------
// Happy path: invite -> accept -> active
// ---------------------------------------------------------------------------
test("invite -> accept -> active is the canonical member lifecycle", () => {
  // A manager invites (create -> invited).
  assert.equal(canPerformMembershipAction("manager", "invite", "invited"), true);
  assert.equal(statusAfterAction("invite"), "invited");

  // The invited artist accepts (invited -> active).
  assert.equal(canPerformMembershipAction("self", "accept", "invited"), true);
  assert.equal(canTransitionMemberStatus("self", "invited", "active"), true);
  assert.equal(statusAfterAction("accept"), "active");
});

// ---------------------------------------------------------------------------
// No unilateral adding / no self-escalation
// ---------------------------------------------------------------------------
test("a non-manager cannot invite anyone", () => {
  assert.equal(canPerformMembershipAction("self", "invite", "invited"), false);
  assert.equal(canPerformMembershipAction("other", "invite", "invited"), false);
});

test("an artist must accept — a manager cannot force invited -> active as 'self'", () => {
  // 'self' can move invited->active (that IS the accept); 'other' cannot touch it.
  assert.equal(canTransitionMemberStatus("other", "invited", "active"), false);
});

test("a member cannot change their own role or mode; only a manager can", () => {
  assert.equal(canEditMemberRoleOrMode("self"), false);
  assert.equal(canEditMemberRoleOrMode("other"), false);
  assert.equal(canEditMemberRoleOrMode("manager"), true);
});

// ---------------------------------------------------------------------------
// Self edges: accept / decline / leave — and nothing else
// ---------------------------------------------------------------------------
test("self may accept, decline, and leave", () => {
  assert.equal(canPerformMembershipAction("self", "accept", "invited"), true);
  assert.equal(canPerformMembershipAction("self", "decline", "invited"), true);
  assert.equal(canPerformMembershipAction("self", "leave", "active"), true);
});

test("self cannot leave what was never accepted, nor accept twice", () => {
  assert.equal(canPerformMembershipAction("self", "leave", "invited"), false);
  assert.equal(canPerformMembershipAction("self", "accept", "active"), false);
});

test("self status transitions are limited to the three edges", () => {
  // legal
  assert.equal(canTransitionMemberStatus("self", "invited", "active"), true); // accept
  assert.equal(canTransitionMemberStatus("self", "invited", "removed"), true); // decline
  assert.equal(canTransitionMemberStatus("self", "active", "removed"), true); // leave
  // illegal: reactivating after leaving, or bypassing invited
  assert.equal(canTransitionMemberStatus("self", "removed", "active"), false);
  assert.equal(canTransitionMemberStatus("self", "active", "invited"), false);
});

// ---------------------------------------------------------------------------
// Manager edges
// ---------------------------------------------------------------------------
test("a manager may remove an invited or active member", () => {
  assert.equal(canPerformMembershipAction("manager", "remove", "invited"), true);
  assert.equal(canPerformMembershipAction("manager", "remove", "active"), true);
  assert.equal(statusAfterAction("remove"), "removed");
});

test("a manager may re-invite or reinstate a removed member", () => {
  assert.equal(canTransitionMemberStatus("manager", "removed", "invited"), true);
  assert.equal(canTransitionMemberStatus("manager", "removed", "active"), true);
});

// ---------------------------------------------------------------------------
// Capability matrix: promotional vs managed
// ---------------------------------------------------------------------------
test("an ACTIVE MANAGED member exposes their agenda to the shop", () => {
  const caps = shopMemberCapabilities({ status: "active", membership_mode: "managed" });
  assert.equal(caps.shopCanViewAgenda, true);
  assert.equal(caps.shopManagesArtist, true);
  assert.equal(caps.artistIndependent, false);
  assert.equal(caps.listedInRoster, true);
  assert.equal(caps.showsShopBadge, true);
  assert.equal(shopCanViewMemberAgenda({ status: "active", membership_mode: "managed" }), true);
});

test("an ACTIVE PROMOTIONAL member keeps full independence — no agenda access", () => {
  const caps = shopMemberCapabilities({ status: "active", membership_mode: "promotional" });
  assert.equal(caps.shopCanViewAgenda, false);
  assert.equal(caps.shopManagesArtist, false);
  assert.equal(caps.artistIndependent, true);
  // still publicly listed + badged (that's the promotional value)
  assert.equal(caps.listedInRoster, true);
  assert.equal(caps.showsShopBadge, true);
  assert.equal(shopCanViewMemberAgenda({ status: "active", membership_mode: "promotional" }), false);
});

test("managed capabilities are gated behind ACCEPTANCE — an invited managed member exposes nothing", () => {
  const caps = shopMemberCapabilities({ status: "invited", membership_mode: "managed" });
  assert.equal(caps.shopCanViewAgenda, false, "not until they accept");
  assert.equal(caps.listedInRoster, false, "invited members are not on the public roster");
  assert.equal(caps.showsShopBadge, false);
  assert.equal(caps.artistIndependent, true);
});

test("a removed member exposes nothing regardless of mode", () => {
  for (const mode of ["promotional", "managed"] as const) {
    const caps = shopMemberCapabilities({ status: "removed", membership_mode: mode });
    assert.equal(caps.shopCanViewAgenda, false);
    assert.equal(caps.listedInRoster, false);
    assert.equal(caps.showsShopBadge, false);
  }
});
