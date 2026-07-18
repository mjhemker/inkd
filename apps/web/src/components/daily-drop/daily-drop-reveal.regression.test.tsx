import { describe, it, expect, beforeAll } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InkdProvider } from "@inkd/core/hooks";
import type { DailyDropCard as DailyDropCardData } from "@inkd/core";
import type { FeedArtist } from "@inkd/core";
import { DailyDropReveal } from "./DailyDropReveal";
import { MuseumPlacard } from "../feed/MuseumPlacard";
import { createDropMockClient } from "../../app/dev/daily-drop-preview/dropMockClient";
import { dailyDropDemoSeed } from "../../app/dev/daily-drop-preview/dropSeed";

/**
 * Regression test for the Round-5 "discovery links are dead" report: the founder
 * saw the full-screen Daily Drop reveal, dismissed/interacted, then every artist
 * link (feed-card names, the reveal's "View artist" / "View the piece", profile
 * navigation) stopped responding — the classic symptom of a full-screen takeover
 * that leaves a transparent `fixed inset-0` backdrop mounted, swallowing clicks.
 *
 * These tests lock in the two guarantees that failure mode would break:
 *   (a) dismissing the reveal (from the teaser OR after it's opened) removes its
 *       `role="dialog"` backdrop from the DOM entirely — nothing lingers over the
 *       page to intercept pointer events; and
 *   (b) every artist destination the founder named is a real, navigable `<a>`
 *       with the right href (not a `<button onClick={router.push}>` or a Link with
 *       a preventDefault'd parent) — so a normal click always routes.
 *
 * Renders the SHIPPED components against the daily-drop mock client (no network),
 * mirroring how FeedScreen mounts/unmounts the reveal by state.
 */

const TODAY = new Date().toISOString().slice(0, 10);

const FEED_ARTIST: FeedArtist = {
  artistId: "art-mara",
  profileId: "prof-mara",
  handle: "maravance",
  displayName: "Mara Vance",
  avatarUrl: null,
  city: "Brooklyn",
  state: "NY",
  styles: ["Blackwork"],
  acceptsNewClients: true,
  isFollowedByViewer: false,
};

// A POST-type drop so the reveal renders the founder's exact CTA labels
// ("View artist" + "View the piece"), not the flash variant.
const POST_CARD: DailyDropCardData = {
  id: "drop-regression",
  dropDate: TODAY,
  reason: "Because you keep saving fine-line botanicals",
  reasonStyle: "fine-line",
  isColdStart: false,
  seenAt: null,
  clickedAt: null,
  reactedAt: null,
  subjectType: "post",
  subjectId: "post-1",
  artist: FEED_ARTIST,
  post: {
    coverUrl: null,
    caption: "healed rose",
    likeCount: 3,
    likedByViewer: false,
    savedByViewer: false,
    styleTags: [{ id: "st-fl", slug: "fine-line", name: "Fine Line" }],
  },
};

function Harness() {
  // Mirrors FeedScreen: the reveal is a state-gated child; dismissing unmounts it.
  const [dismissed, setDismissed] = useState(false);
  return (
    <InkdProvider client={createDropMockClient(dailyDropDemoSeed)}>
      {/* A representative feed-card artist link (the museum placard). */}
      <MuseumPlacard artist={FEED_ARTIST} styleTags={POST_CARD.post!.styleTags} />
      {!dismissed && (
        <DailyDropReveal card={POST_CARD} onDismiss={() => setDismissed(true)} />
      )}
    </InkdProvider>
  );
}

beforeAll(() => {
  // The reveal reads prefers-reduced-motion; jsdom has no matchMedia. Report
  // "reduce" so the teaser -> revealed transition is synchronous (no timers).
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

describe("Daily Drop reveal — link-death regression", () => {
  it("feed-card artist name is a real navigable anchor to the profile", () => {
    render(<Harness />);
    const link = screen.getByRole("link", { name: /maravance/i });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/a/maravance");
  });

  it("the reveal renders a modal dialog backdrop while open", () => {
    render(<Harness />);
    expect(
      screen.getByRole("dialog", { name: /your daily drop/i }),
    ).toBeTruthy();
  });

  it("reveal CTAs are real navigable anchors (View artist -> profile, View the piece -> /daily-drop)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /reveal my drop/i }));

    const dialog = screen.getByRole("dialog", { name: /your daily drop/i });
    const viewArtist = within(dialog).getByRole("link", { name: /view artist/i });
    expect(viewArtist.tagName).toBe("A");
    expect(viewArtist.getAttribute("href")).toBe("/a/maravance");

    const viewPiece = within(dialog).getByRole("link", { name: /view the piece/i });
    expect(viewPiece.tagName).toBe("A");
    expect(viewPiece.getAttribute("href")).toBe("/daily-drop");
  });

  it("dismissing from the teaser removes the reveal backdrop (no lingering overlay)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole("dialog", { name: /your daily drop/i })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /maybe later/i }));

    // The whole fixed-inset-0 backdrop must be gone — not merely hidden.
    expect(screen.queryByRole("dialog", { name: /your daily drop/i })).toBeNull();
    // And the underlying feed-card link is still present and clickable.
    expect(
      screen.getByRole("link", { name: /maravance/i }).getAttribute("href"),
    ).toBe("/a/maravance");
  });

  it("dismissing AFTER opening the reveal also removes the backdrop entirely", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /reveal my drop/i }));

    const dialog = screen.getByRole("dialog", { name: /your daily drop/i });
    // The revealed panel exposes two dismiss affordances (the corner X and the
    // footer button), both named "Dismiss"; either must fully unmount the reveal.
    const [dismissBtn] = within(dialog).getAllByRole("button", {
      name: /^dismiss$/i,
    });
    await user.click(dismissBtn!);

    expect(screen.queryByRole("dialog", { name: /your daily drop/i })).toBeNull();
    expect(
      screen.getByRole("link", { name: /maravance/i }).getAttribute("href"),
    ).toBe("/a/maravance");
  });
});
