/**
 * Seed data for the offline feed preview. Mirrors the shape of the live demo
 * feed (three artists across Baltimore + Philadelphia, style-tagged posts, two
 * flash sheets, a following/likes/saves graph for the viewer) but with null
 * cover images so the deterministic gradient frames render — no external image
 * egress needed for screenshots. Dev-only.
 */
import type { FeedMockSeed } from "./feedMockClient";

const VIEWER = "pr-viewer-riley";

function daysAgo(n: number): string {
  const d = new Date("2026-07-15T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

// --- styles taxonomy (subset) ----------------------------------------------
const styles = [
  { id: "st-blackwork", slug: "blackwork", name: "Blackwork", sort_order: 140 },
  { id: "st-fine-line", slug: "fine-line", name: "Fine Line", sort_order: 60 },
  { id: "st-floral", slug: "floral-botanical", name: "Floral / Botanical", sort_order: 220 },
  { id: "st-dotwork", slug: "dotwork", name: "Dotwork", sort_order: 150 },
  { id: "st-ornamental", slug: "ornamental", name: "Ornamental", sort_order: 80 },
  { id: "st-neotrad", slug: "neo-traditional", name: "Neo-Traditional", sort_order: 20 },
  { id: "st-illustrative", slug: "illustrative", name: "Illustrative", sort_order: 180 },
  { id: "st-watercolor", slug: "watercolor", name: "Watercolor", sort_order: 190 },
  { id: "st-script", slug: "script-lettering", name: "Script / Lettering", sort_order: 70 },
  { id: "st-irezumi", slug: "japanese-irezumi", name: "Japanese / Irezumi", sort_order: 30 },
];

// --- profiles + artist_profiles --------------------------------------------
const profiles = [
  {
    id: VIEWER,
    handle: "riley",
    display_name: "Riley Okafor",
    avatar_url: null,
    city: "Baltimore",
    state: "MD",
    is_public: true,
    is_artist: false,
  },
  { id: "pr-jayden", handle: "jayden.ink", display_name: "Jayden Cole", avatar_url: null, city: "Baltimore", state: "MD", is_public: true, is_artist: true },
  { id: "pr-nova", handle: "nova.reyes", display_name: "Nova Reyes", avatar_url: null, city: "Baltimore", state: "MD", is_public: true, is_artist: true },
  { id: "pr-sol", handle: "sol.script", display_name: "Sol Marín", avatar_url: null, city: "Philadelphia", state: "PA", is_public: true, is_artist: true },
];

const artist_profiles = [
  { id: "ar-jayden", profile_id: "pr-jayden", styles: ["Blackwork", "Fine line", "Botanical"], accepts_new_clients: true, is_published: true },
  { id: "ar-nova", profile_id: "pr-nova", styles: ["Neo-traditional", "Illustrative"], accepts_new_clients: true, is_published: true },
  { id: "ar-sol", profile_id: "pr-sol", styles: ["Script/Lettering", "Fine line"], accepts_new_clients: false, is_published: true },
];

// --- posts ------------------------------------------------------------------
interface SeedPost {
  id: string;
  artist_id: string;
  caption: string;
  like_count: number;
  day: number;
  styleIds: string[];
}

const seedPosts: SeedPost[] = [
  { id: "po-j1", artist_id: "ar-jayden", caption: "Healed blackwork raven — one session, all freehand.", like_count: 34, day: 1, styleIds: ["st-blackwork", "st-dotwork"] },
  { id: "po-j2", artist_id: "ar-jayden", caption: "Fine-line wildflowers wrapping the forearm.", like_count: 21, day: 4, styleIds: ["st-fine-line", "st-floral"] },
  { id: "po-j3", artist_id: "ar-jayden", caption: "Ornamental sternum piece — dotwork shading up close.", like_count: 48, day: 7, styleIds: ["st-ornamental", "st-dotwork"] },
  { id: "po-j4", artist_id: "ar-jayden", caption: "Botanical half-sleeve in progress. Session two next week.", like_count: 12, day: 11, styleIds: ["st-floral", "st-fine-line"] },
  { id: "po-j5", artist_id: "ar-jayden", caption: "Solid black bands, healed and settled.", like_count: 27, day: 16, styleIds: ["st-blackwork"] },
  { id: "po-n1", artist_id: "ar-nova", caption: "Neo-trad panther, bold lines and a lot of saturation.", like_count: 40, day: 2, styleIds: ["st-neotrad", "st-illustrative"] },
  { id: "po-n2", artist_id: "ar-nova", caption: "Watercolor koi — no black outline, all blends.", like_count: 33, day: 6, styleIds: ["st-watercolor", "st-illustrative"] },
  { id: "po-n3", artist_id: "ar-nova", caption: "Illustrative fox with a storybook feel.", like_count: 18, day: 9, styleIds: ["st-illustrative"] },
  { id: "po-n4", artist_id: "ar-nova", caption: "Neo-trad rose, healed six months on.", like_count: 25, day: 14, styleIds: ["st-neotrad"] },
  { id: "po-s1", artist_id: "ar-sol", caption: "Hand-lettered script down the spine.", like_count: 15, day: 3, styleIds: ["st-script", "st-fine-line"] },
  { id: "po-s2", artist_id: "ar-sol", caption: "Single-needle lettering, barely-there.", like_count: 9, day: 8, styleIds: ["st-script", "st-fine-line"] },
  { id: "po-s3", artist_id: "ar-sol", caption: "Micro fine-line date, the size of a coin.", like_count: 6, day: 13, styleIds: ["st-fine-line"] },
];

const posts = seedPosts.map((p) => ({
  id: p.id,
  artist_id: p.artist_id,
  caption: p.caption,
  media: [],
  cover_url: null,
  source: "inkd",
  is_public: true,
  like_count: p.like_count,
  created_at: daysAgo(p.day),
}));

const post_styles = seedPosts.flatMap((p) =>
  p.styleIds.map((style_id) => ({ post_id: p.id, style_id, artist_id: p.artist_id })),
);

// --- flash ------------------------------------------------------------------
const flash_items = [
  { id: "fl-j1", flash_sheet_id: "fs-jayden", artist_id: "ar-jayden", title: "Ember moth", image_url: null, price_cents: 18000, is_repeatable: false, is_available: true, placement_suggestion: "Forearm", size_inches: 4, sort_order: 0, created_at: daysAgo(2) },
  { id: "fl-j2", flash_sheet_id: "fs-jayden", artist_id: "ar-jayden", title: "Dagger & bloom", image_url: null, price_cents: 22000, is_repeatable: true, is_available: true, placement_suggestion: "Calf", size_inches: 6, sort_order: 1, created_at: daysAgo(2) },
  { id: "fl-j3", flash_sheet_id: "fs-jayden", artist_id: "ar-jayden", title: "Crescent snake", image_url: null, price_cents: 15000, is_repeatable: false, is_available: false, placement_suggestion: "Inner arm", size_inches: 3, sort_order: 2, created_at: daysAgo(2) },
  { id: "fl-n1", flash_sheet_id: "fs-nova", artist_id: "ar-nova", title: "Neo-trad swallow", image_url: null, price_cents: 20000, is_repeatable: true, is_available: true, placement_suggestion: "Shoulder", size_inches: 5, sort_order: 0, created_at: daysAgo(5) },
];

// --- social graph -----------------------------------------------------------
const follows = [
  { follower_id: VIEWER, artist_id: "ar-jayden" },
  { follower_id: VIEWER, artist_id: "ar-nova" },
];
const post_likes = [
  { post_id: "po-j1", profile_id: VIEWER },
  { post_id: "po-n1", profile_id: VIEWER },
  { post_id: "po-j3", profile_id: VIEWER },
];
const saved_posts = [
  { post_id: "po-n2", profile_id: VIEWER },
  { post_id: "po-j2", profile_id: VIEWER },
];

export const feedDemoSeed: FeedMockSeed = {
  viewerId: VIEWER,
  email: "riley@example.com",
  tables: {
    styles,
    profiles,
    artist_profiles,
    posts,
    post_styles,
    flash_items,
    follows,
    post_likes,
    saved_posts,
  },
};

/** A signed-out variant — no viewer, so likes/saves/follow are gated + the
 * Following scope is empty (drives the empty-state screenshot). */
export const feedSignedOutSeed: FeedMockSeed = {
  ...feedDemoSeed,
  viewerId: null,
  tables: { ...feedDemoSeed.tables, follows: [], post_likes: [], saved_posts: [] },
};
