# INKD Zine Hierarchy — the one-hero law

_The visual-hierarchy contract for the "Zine System" pass (3A Daylight / 3B
Night). Foundation lives in `@inkd/ui`; screens apply it. This is a
VISUAL/HIERARCHY-ONLY discipline — no behavior changes._

## The law

> **The offset shadow appears exactly once per screen — on the thing you should
> click** (ink in daylight, ember at night). Everything else is flat hairline
> cards. Portfolio tiles straight, date chips soft gray, red only on counts &
> medical. Money values render in ember.

Restated as rules:

1. **One hero per screen.** Exactly one element carries the hard SOLID offset
   shadow (0 blur, 5px down-right). It is the single thing the user should click.
   - **Daylight (light):** the offset is **pure ink black**, with a thin ink border.
   - **Night (dark):** the offset is an **ember plate**, with a thin ember border.
   - On press the element translates 3px _into_ its shadow (offset shrinks 5→2) —
     a tactile print-sticker feel.
2. **Everything else is flat.** All other cards are flat 1px hairline surfaces in
   both themes. No elevation/drop shadows on cards. Emphasis comes from borders,
   type, and the single hero — not bloom. (True overlays — Modal, Sheet, Toast,
   Select menu — keep their float shadow; they are layers above the screen, not
   cards competing for the hero.)
3. **Segmented tabs invert to solid ink.** The active tab is solid black w/ white
   text in daylight, solid off-white w/ black text at night — never violet-tinted.
   Inactive tabs are flat hairline.
4. **Red is rationed.** Red appears ONLY on: counts (nav / tab count pills),
   AWAITING-type stamps, and Medical. Nothing else is red.
5. **Money is ember.** Price / money / key stat values render in ember (mono,
   tabular).
6. **Dates recede.** Date chips are soft gray, never colored, never loud.
7. **Portfolio tiles are straight.** Square/straight edges, no rounding flourish,
   flat.

## Components never self-declare hero

The hero is a **per-screen** decision, not a component default. Primitives expose
a `hero` prop (opt-in); a screen sets it on the ONE element that is that screen's
action. A `<Button>` or `<Card>` is never `hero` by default. If two things on a
screen look like the hero, one of them is wrong.

## Consuming the foundation

| Need | Web | Native |
| --- | --- | --- |
| Hero action button | `<Button hero>` | `<Button hero>` |
| Hero action card (card IS the action) | `<Card hero>` | `<Card hero>` |
| Hero offset on a custom element | `className="hero-offset"` | `bg-hero-shadow` backing View + `border-hero-border` (see Button/Card native for the pattern) |
| Hero offset token (advanced) | `shadow-hero` / `shadow-hero-pressed` | — |
| Active-ink tabs | `<Tabs>` (built in) | `<Tabs>` (built in) |
| Red count pill in a tab | pass into the tab `icon`/`badge` slot | tab `badge` slot |
| AWAITING / MEDICAL stamp | `<Badge variant="stamp">` | `<Badge variant="stamp">` |
| Soft-gray date chip | `<Badge variant="date">` | `<Badge variant="date">` |
| Money / price / stat | `className="text-money"` | `className="font-mono-medium text-content-ember"` |
| Staff ON/OFF status | `<StatusDot on />` | `<StatusDot on />` |
| DEPOSIT DUE | `<Badge variant="ember">` | `<Badge variant="ember">` |
| SCHEDULED | `<Badge variant="brand">` | `<Badge variant="brand">` |
| HEALED | `<Badge variant="success">` | `<Badge variant="success">` |
| Flat card (everything else) | `<Card>` (default/raised/outlined) | `<Card>` |

Tokens: `themes.dark.hero` (ember) / `themes.light.hero` (ink) in
`@inkd/ui/tokens`; CSS vars `--color-hero-shadow` / `--color-hero-border` in each
app's theme layer; `hero` color group in the shared Tailwind preset.

### Native offset technique (why not a shadow)

React Native cannot render a hard, 0-blur, theme-colored offset reliably —
Android `elevation` produces a blurred grey system shadow and iOS `shadow*` blurs
too. So the native `hero` primitives paint the offset as an **absolutely-
positioned backing `View`** shifted 5px down-right BEHIND the face
(`bg-hero-shadow`, matching border radius). This is pixel-identical on iOS and
Android. On press the face translates 3px into the backing (visible offset
shrinks 5→2). Never wrap a hero in `overflow-hidden` — it clips the backing.

## One-per-screen HERO REGISTRY

The single hero for each screen. Surface agents wire the `hero` prop onto exactly
the element named here — and nothing else on that screen gets an offset shadow.

| Screen | The one hero |
| --- | --- |
| Dashboard | The **"N approvals waiting for you"** banner |
| AI-staff Approvals | **Approve & send** on the top card |
| Public artist profile | **Request a booking** |
| Settings form tabs | **Save changes** |
| Bookings Inbox | The **top needs-review card** (`<Card hero>`) |
| Own profile tabs | **+ Add** / **+ New post** |
| Playbook | **+ Add entry** |
| Booking-flow steps | The primary **Continue / Submit** |
| Feed | **NO hero** — content is king |

If a screen isn't listed, pick the single most important action on it and make
that the hero; if the screen is a browsing/reading surface (like Feed), it may
have no hero at all.
