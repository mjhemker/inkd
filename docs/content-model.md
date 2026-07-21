# Content model: Posts vs Portfolio pieces

INKD artists publish two distinct kinds of visual content from their profile.
They look similar (an image + some tags) but play different roles, so the Add
flows, the surfaces they appear on, and the fields that matter differ. This doc
is the source of truth for that distinction and for how each maps onto the
existing tables (no schema changes this round).

## The two kinds

### Post — feed content
A **post** is a social/feed unit. It is **caption-first**: the story around the
work leads, the image supports it. Posts:

- appear in the public discovery **feed** (`posts` where `is_public = true`),
- are **caption-first** (caption is the primary field; title is not a concept),
- carry **optional style tags** for discovery,
- can be flagged as **bookable flash with a price** — a client can act on it,
- accept **photo or video** media,
- are ordered by recency (newest first); there is no manual gallery order.

Think of a post as "here's something I want to say / show right now."

### Portfolio piece — gallery / proof content
A **portfolio piece** is a curated gallery unit and the **booking-credibility
surface** — what a prospective client scrolls to decide whether to book. Pieces:

- live in the artist's **gallery**, manually **ordered** (`sort_order`); the
  first piece is the public **cover**,
- have an **optional title** (an image with no title is fine),
- foreground **placement** (forearm, ribs, calf…) and **healed-vs-fresh**
  state — healed work is the strongest proof,
- track **session count** as a model concept (see "Deferred" below),
- carry **style tags** used for filtering/credibility,
- are images (proof shots), not videos.

Think of a piece as "here's proof of what I can do, arranged to sell my work."

## Field / persistence mapping (no migrations this round)

| Concept                | Post (`posts`)                              | Portfolio (`portfolio_pieces`) |
| ---------------------- | ------------------------------------------- | ------------------------------ |
| Primary text           | `caption`                                   | `title` (optional)             |
| Secondary text         | —                                           | `description`                  |
| Media                  | `media` jsonb array + `cover_url`           | `image_url`                    |
| Public flag            | `is_public`                                 | `is_public`                    |
| Style tags (taxonomy)  | `post_styles` join (by style **id**)        | `style_tags` (string **slugs**)|
| Custom / free-text tags| `media[0].custom_style_tags` (jsonb)        | `style_tags` (free strings)    |
| Placement              | `media[0].placement` (jsonb, optional)      | `placement`                    |
| Healed vs fresh        | —                                           | `is_healed`                    |
| Flash + price          | `media[0].is_flash` + `media[0].price_cents`| — (use the Flash tab instead)  |
| Ordering               | recency (`created_at`)                      | `sort_order` (manual, cover=0) |

Notes on the jsonb mappings (chosen to avoid a migration this round):

- **Flash-on-a-post**: the `posts` table has no flash/price columns, but `media`
  is `jsonb`. The New post flow writes `{ url, is_flash, price_cents }` into
  `media[0]`. The feed renderer can pick this up later; feed rendering was out
  of scope for this change and is untouched.
- **Custom style tags on a post**: `post_styles` is a FK join to the `styles`
  taxonomy, so a free-text tag that isn't a taxonomy style can't live there.
  Those free entries are stored in `media[0].custom_style_tags`. Taxonomy styles
  still persist normally via `post_styles`.
- **Portfolio custom tags** need no special handling — `style_tags` is a plain
  `string[]`, so taxonomy slugs and free-text entries coexist there directly.

### Deferred (documented, not built this round)
- **Portfolio `session_count`**: the piece model treats session count as
  meaningful, but `portfolio_pieces` has no column for it and no jsonb blob to
  fold it into cleanly. Rather than add a migration this round, it is captured
  here as a model attribute and left out of the flow's persisted fields. Adding
  a `session_count int` column (or a `meta jsonb`) is the clean follow-up.

## The Add flows (progressive, full-screen)

Both replace the old inline "+Add" sheet with a stepped, one-prompt-per-screen
flow. Shared chrome: `components/create/StepScaffold.tsx` (local back header —
the shared BackButton is owned by another branch and untouched — plus a progress
bar and a sticky primary action). Styles step: `StyleSuggestInput` +
`useStyleOptions` (artist profile styles + recently-used surface first, then the
rest of the taxonomy, plus a free-text "add your own").

**Add to portfolio** — `app/create/portfolio.tsx`
1. Photo (image required)
2. Details — title + description (both optional)
3. Placement & styles — placement, fresh/healed toggle, styles
4. Review & publish → `portfolio_pieces` insert

**New post** — `app/create/post.tsx`
1. Media (photo or video)
2. Caption (caption-first)
3. Flash & styles — flash toggle + price, optional placement, styles
4. Review & publish → `posts` insert (+ `post_styles` for taxonomy styles)

Editing an existing portfolio piece remains an inline sheet; only the *add*
path became a full-screen flow.
