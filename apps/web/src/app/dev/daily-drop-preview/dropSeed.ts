/**
 * Demo data for the offline Daily Drop preview harness. A signed-in client who
 * follows blackwork + fine-line artists, with today's personalized pick and a
 * few days of history (post + flash mix). cover_url/image_url are left null so
 * the deterministic gradient "frames" render — no image egress needed.
 */
import type { DropMockSeed } from "./dropMockClient";

const VIEWER = "viewer-1";

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
function isoTime(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

const STYLES = [
  { id: "st-black", slug: "blackwork", name: "Blackwork" },
  { id: "st-fine", slug: "fineline", name: "Fine Line" },
  { id: "st-neo", slug: "neo-traditional", name: "Neo Traditional" },
];

const PROFILES = [
  { id: "viewer-1", handle: "aria", display_name: "Aria", avatar_url: null, city: "Brooklyn", state: "NY", is_public: true },
  { id: "prof-mara", handle: "maravance", display_name: "Mara Vance", avatar_url: null, city: "Brooklyn", state: "NY", is_public: true },
  { id: "prof-dex", handle: "dexokafor", display_name: "Dex Okafor", avatar_url: null, city: "Austin", state: "TX", is_public: true },
  { id: "prof-rue", handle: "ruesalas", display_name: "Rue Salas", avatar_url: null, city: "Los Angeles", state: "CA", is_public: true },
];

const ARTISTS = [
  { id: "art-mara", profile_id: "prof-mara", styles: ["Blackwork", "Illustrative"], accepts_new_clients: true, is_published: true },
  { id: "art-dex", profile_id: "prof-dex", styles: ["Fine Line", "Micro"], accepts_new_clients: false, is_published: true },
  { id: "art-rue", profile_id: "prof-rue", styles: ["Neo Traditional", "Color"], accepts_new_clients: true, is_published: true },
];

const POSTS = [
  { id: "p-black", artist_id: "art-mara", caption: "Ornamental blackwork forearm band.", cover_url: null, is_public: true, like_count: 132, created_at: isoTime(1) },
  { id: "p-fine", artist_id: "art-dex", caption: "Fine-line botanical study.", cover_url: null, is_public: true, like_count: 74, created_at: isoTime(2) },
  { id: "p-neo", artist_id: "art-rue", caption: "Neo-traditional panther.", cover_url: null, is_public: true, like_count: 58, created_at: isoTime(4) },
];

const POST_STYLES = [
  { post_id: "p-black", style_id: "st-black", artist_id: "art-mara" },
  { post_id: "p-fine", style_id: "st-fine", artist_id: "art-dex" },
  { post_id: "p-neo", style_id: "st-neo", artist_id: "art-rue" },
];

const FLASH = [
  {
    id: "f-dagger",
    flash_sheet_id: "fs-rue",
    artist_id: "art-rue",
    title: "Ember dagger",
    image_url: null,
    price_cents: 18000,
    is_available: true,
    is_repeatable: true,
    placement_suggestion: "Forearm",
    size_inches: 4,
    created_at: isoTime(3),
  },
];

const DAILY_DROPS = [
  {
    id: "drop-today",
    user_id: VIEWER,
    drop_date: isoDate(0),
    subject_type: "post",
    subject_id: "p-black",
    artist_id: "art-mara",
    reason: "Because you follow artists who work in Blackwork",
    reason_style: "blackwork",
    is_cold_start: false,
    score: 8.7,
    generated_at: isoTime(0),
    seen_at: null,
    clicked_at: null,
    reacted_at: null,
  },
  {
    id: "drop-1",
    user_id: VIEWER,
    drop_date: isoDate(1),
    subject_type: "flash",
    subject_id: "f-dagger",
    artist_id: "art-rue",
    reason: "Because you love Neo Traditional work",
    reason_style: "neo-traditional",
    is_cold_start: false,
    score: 6.1,
    generated_at: isoTime(1),
    seen_at: isoTime(1),
    clicked_at: null,
    reacted_at: null,
  },
  {
    id: "drop-2",
    user_id: VIEWER,
    drop_date: isoDate(2),
    subject_type: "post",
    subject_id: "p-fine",
    artist_id: "art-dex",
    reason: "Because you've been saving Fine Line work",
    reason_style: "fineline",
    is_cold_start: false,
    score: 5.4,
    generated_at: isoTime(2),
    seen_at: isoTime(2),
    clicked_at: isoTime(2),
    reacted_at: null,
  },
  {
    id: "drop-3",
    user_id: VIEWER,
    drop_date: isoDate(3),
    subject_type: "post",
    subject_id: "p-neo",
    artist_id: "art-rue",
    reason: "Because you love Neo Traditional work",
    reason_style: "neo-traditional",
    is_cold_start: false,
    score: 5.0,
    generated_at: isoTime(3),
    seen_at: isoTime(3),
    clicked_at: null,
    reacted_at: isoTime(3),
  },
];

export const dailyDropDemoSeed: DropMockSeed = {
  viewerId: VIEWER,
  email: "aria@example.com",
  tables: {
    profiles: PROFILES,
    artist_profiles: ARTISTS,
    styles: STYLES,
    posts: POSTS,
    post_styles: POST_STYLES,
    flash_items: FLASH,
    follows: [
      { follower_id: VIEWER, artist_id: "art-mara" },
      { follower_id: VIEWER, artist_id: "art-dex" },
    ],
    post_likes: [],
    saved_posts: [{ profile_id: VIEWER, post_id: "p-fine" }],
    daily_drops: DAILY_DROPS,
  },
};
