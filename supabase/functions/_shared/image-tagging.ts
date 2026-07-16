// INKD AI image-understanding — pure, dependency-free core.
//
// This module powers auto-tagging of artist images (portfolio_pieces / posts /
// flash_items) for discovery, match-my-inspiration, and the daily drop. Artists
// NEVER tag manually, so the discovery style filter is only as good as what this
// produces.
//
// Two responsibilities, both fully deterministic and unit-tested OFFLINE (no
// network, no Anthropic, no Supabase — see image-tagging.test.ts):
//
//   1. mapVisionTags()  — take a vision model's loose JSON classification and map
//      it onto the CANONICAL taxonomy: real style slugs (public.styles), a fixed
//      color/size enum, a canonical placement vocab, and a cleaned subject list.
//
//   2. buildImageVector() — derive a deterministic "semantic fingerprint"
//      embedding from those structured tags. See EMBEDDING APPROACH below.
//
// ── EMBEDDING APPROACH (and the tradeoff) ──────────────────────────────────
// Anthropic has NO embeddings API, and we refuse to make the founder add another
// paid key. So instead of a pixel-level CLIP vector we build the embedding
// DETERMINISTICALLY from the structured tags Claude Vision returns:
//
//   • a per-style block (confidence-weighted over the 25 canonical slugs),
//   • a canonical placement multi-hot block,
//   • color-type + size ordinal blocks,
//   • signed feature-hashing blocks over the open-vocab subject_matter list and
//     the free-text description.
//
// The whole vector is L2-normalized so cosine similarity (pgvector `<=>`) ranks
// visually/stylistically similar works. This needs ZERO extra infrastructure or
// keys and is byte-for-byte reproducible in TS and re-derivable later.
//
// TRADEOFF: this is a *semantic tag* fingerprint, not a raw visual embedding. Two
// images a human finds visually similar but that the model tags differently will
// score lower than a true CLIP model would. In exchange we get: no new key, no
// network dependency beyond the one vision call, full determinism/testability,
// and — critically — the fingerprint is built from exactly the axes discovery and
// match-inspiration care about (style × placement × color × subject). The schema
// stores a plain vector(N); swapping in a real CLIP/text embedding later is a
// drop-in change to buildImageVector() + a re-tag, with the DB, similar_works(),
// and RLS untouched. VECTOR_DIM is the contract both sides pin to.

// ---------------------------------------------------------------------------
// Canonical taxonomy — MUST stay in sync with supabase/migrations seed_styles.
// Order is load-bearing: it fixes each style's slot in the embedding.
// ---------------------------------------------------------------------------
export const STYLE_SLUGS: readonly string[] = [
  "american-traditional",
  "neo-traditional",
  "japanese-irezumi",
  "tribal",
  "chicano",
  "fine-line",
  "script-lettering",
  "ornamental",
  "minimalist",
  "realism",
  "black-and-grey",
  "portrait",
  "micro-realism",
  "blackwork",
  "dotwork",
  "geometric",
  "new-school",
  "illustrative",
  "watercolor",
  "sticker-ignorant",
  "anime",
  "floral-botanical",
  "surrealism",
  "trash-polka",
  "biomechanical",
] as const;

const STYLE_INDEX: Map<string, number> = new Map(
  STYLE_SLUGS.map((s, i) => [s, i]),
);

// Free-text → canonical slug aliases. Keys are normalized (lowercase, spaces).
// Everything the model might reasonably emit that isn't already a slug.
const STYLE_ALIASES: Record<string, string> = {
  "traditional": "american-traditional",
  "american": "american-traditional",
  "old school": "american-traditional",
  "neotraditional": "neo-traditional",
  "neo traditional": "neo-traditional",
  "japanese": "japanese-irezumi",
  "irezumi": "japanese-irezumi",
  "oriental": "japanese-irezumi",
  "polynesian": "tribal",
  "maori": "tribal",
  "fineline": "fine-line",
  "single needle": "fine-line",
  "linework": "fine-line",
  "line work": "fine-line",
  "script": "script-lettering",
  "lettering": "script-lettering",
  "calligraphy": "script-lettering",
  "text": "script-lettering",
  "typography": "script-lettering",
  "ornament": "ornamental",
  "filigree": "ornamental",
  "mandala": "ornamental",
  "minimal": "minimalist",
  "simple": "minimalist",
  "realistic": "realism",
  "photorealism": "realism",
  "photo realism": "realism",
  "hyperrealism": "realism",
  "black and grey": "black-and-grey",
  "black and gray": "black-and-grey",
  "black & grey": "black-and-grey",
  "black & gray": "black-and-grey",
  "bng": "black-and-grey",
  "b&g": "black-and-grey",
  "grey wash": "black-and-grey",
  "portraiture": "portrait",
  "microrealism": "micro-realism",
  "micro realism": "micro-realism",
  "micro": "micro-realism",
  "blackout": "blackwork",
  "solid black": "blackwork",
  "black work": "blackwork",
  "dot work": "dotwork",
  "stippling": "dotwork",
  "pointillism": "dotwork",
  "geometry": "geometric",
  "sacred geometry": "geometric",
  "newschool": "new-school",
  "new school": "new-school",
  "cartoon": "new-school",
  "illustration": "illustrative",
  "illustrated": "illustrative",
  "neo japanese": "illustrative",
  "watercolour": "watercolor",
  "water color": "watercolor",
  "sticker": "sticker-ignorant",
  "ignorant": "sticker-ignorant",
  "naive": "sticker-ignorant",
  "flash": "sticker-ignorant",
  "manga": "anime",
  "floral": "floral-botanical",
  "botanical": "floral-botanical",
  "flower": "floral-botanical",
  "flowers": "floral-botanical",
  "nature": "floral-botanical",
  "surreal": "surrealism",
  "trashpolka": "trash-polka",
  "trash polka": "trash-polka",
  "biomech": "biomechanical",
  "bio mechanical": "biomechanical",
  "cyborg": "biomechanical",
};

// Canonical placement vocab. Order fixes the multi-hot slots. "other" is the
// catch-all bucket for anything unmapped (keeps the block width constant).
export const PLACEMENT_VOCAB: readonly string[] = [
  "arm",
  "forearm",
  "upper-arm",
  "sleeve",
  "hand",
  "wrist",
  "shoulder",
  "chest",
  "back",
  "ribs",
  "stomach",
  "hip",
  "thigh",
  "calf",
  "leg",
  "foot",
  "ankle",
  "neck",
  "head",
  "other",
] as const;

const PLACEMENT_INDEX: Map<string, number> = new Map(
  PLACEMENT_VOCAB.map((p, i) => [p, i]),
);

// Longest-first so specific terms (forearm, upper-arm) win over "arm" in the
// substring fallback of toCanonicalPlacement.
const PLACEMENT_BY_SPECIFICITY: readonly string[] = PLACEMENT_VOCAB
  .filter((p) => p !== "other")
  .slice()
  .sort((a, b) => b.length - a.length);

const PLACEMENT_ALIASES: Record<string, string> = {
  "bicep": "upper-arm",
  "biceps": "upper-arm",
  "tricep": "upper-arm",
  "upper arm": "upper-arm",
  "full sleeve": "sleeve",
  "half sleeve": "sleeve",
  "inner arm": "forearm",
  "outer arm": "forearm",
  "hands": "hand",
  "finger": "hand",
  "fingers": "hand",
  "knuckle": "hand",
  "wrists": "wrist",
  "shoulders": "shoulder",
  "collarbone": "chest",
  "sternum": "chest",
  "pec": "chest",
  "upper back": "back",
  "lower back": "back",
  "spine": "back",
  "rib": "ribs",
  "rib cage": "ribs",
  "ribcage": "ribs",
  "side": "ribs",
  "belly": "stomach",
  "abdomen": "stomach",
  "torso": "stomach",
  "hips": "hip",
  "thighs": "thigh",
  "quad": "thigh",
  "calves": "calf",
  "shin": "calf",
  "legs": "leg",
  "knee": "leg",
  "feet": "foot",
  "ankles": "ankle",
  "throat": "neck",
  "face": "head",
  "scalp": "head",
  "skull": "head",
};

export type ColorType = "color" | "black_grey" | "both" | "unknown";
export type SizeEstimate = "small" | "medium" | "large" | "unknown";

const COLOR_ALIASES: Record<string, ColorType> = {
  "color": "color",
  "colour": "color",
  "full color": "color",
  "full colour": "color",
  "colored": "color",
  "coloured": "color",
  "vibrant": "color",
  "black and grey": "black_grey",
  "black and gray": "black_grey",
  "black & grey": "black_grey",
  "black & gray": "black_grey",
  "black grey": "black_grey",
  "bng": "black_grey",
  "greyscale": "black_grey",
  "grayscale": "black_grey",
  "monochrome": "black_grey",
  "blackwork": "black_grey",
  "both": "both",
  "mixed": "both",
  "mix": "both",
};

const SIZE_ALIASES: Record<string, SizeEstimate> = {
  "small": "small",
  "tiny": "small",
  "micro": "small",
  "mini": "small",
  "petite": "small",
  "medium": "medium",
  "mid": "medium",
  "moderate": "medium",
  "large": "large",
  "big": "large",
  "xl": "large",
  "huge": "large",
  "sleeve": "large",
  "full back": "large",
  "bodysuit": "large",
};

// ── Embedding layout (deterministic; sums to VECTOR_DIM) ────────────────────
export const VECTOR_DIM = 256;
const STYLE_DIM = STYLE_SLUGS.length; // 25
const PLACEMENT_DIM = PLACEMENT_VOCAB.length; // 20
const COLOR_DIM = 4;
const SIZE_DIM = 4;
const DESC_DIM = 96;
const SUBJECT_DIM =
  VECTOR_DIM - (STYLE_DIM + PLACEMENT_DIM + COLOR_DIM + SIZE_DIM + DESC_DIM); // remainder

// Block offsets.
const OFF_STYLE = 0;
const OFF_PLACEMENT = OFF_STYLE + STYLE_DIM;
const OFF_COLOR = OFF_PLACEMENT + PLACEMENT_DIM;
const OFF_SIZE = OFF_COLOR + COLOR_DIM;
const OFF_SUBJECT = OFF_SIZE + SIZE_DIM;
const OFF_DESC = OFF_SUBJECT + SUBJECT_DIM;

// Per-block weights applied before the final L2-normalize. Styles dominate
// (the primary discovery axis); subject and color matter; size/desc are softer.
const W_STYLE = 1.0;
const W_PLACEMENT = 0.5;
const W_COLOR = 0.6;
const W_SIZE = 0.3;
const W_SUBJECT = 0.7;
const W_DESC = 0.4;

// Sanity: the layout must exactly tile the vector.
if (SUBJECT_DIM <= 0 || OFF_DESC + DESC_DIM !== VECTOR_DIM) {
  throw new Error("image-tagging: embedding block layout does not tile VECTOR_DIM");
}

// ---------------------------------------------------------------------------
// Normalization helpers.
// ---------------------------------------------------------------------------
export function normalizeText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z0-9&\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map one free-text style label to a canonical slug, or null if unrecognized. */
export function toCanonicalStyle(raw: unknown): string | null {
  const norm = normalizeText(raw);
  if (!norm) return null;
  const slug = norm.replace(/\s+/g, "-");
  if (STYLE_INDEX.has(slug)) return slug;
  if (STYLE_ALIASES[norm]) return STYLE_ALIASES[norm];
  // hyphen/space-insensitive slug compare against the canonical list.
  const collapsed = norm.replace(/[\s-]+/g, "");
  for (const s of STYLE_SLUGS) {
    if (s.replace(/-/g, "") === collapsed) return s;
  }
  return null;
}

/** Map one free-text placement label to the canonical vocab (defaults "other"). */
export function toCanonicalPlacement(raw: unknown): string {
  const norm = normalizeText(raw);
  if (!norm) return "other";
  const slug = norm.replace(/\s+/g, "-");
  if (PLACEMENT_INDEX.has(slug)) return slug;
  if (PLACEMENT_ALIASES[norm]) return PLACEMENT_ALIASES[norm];
  // substring hit against a vocab term (e.g. "left forearm" -> "forearm").
  // Check longer terms first so "forearm"/"upper-arm" win over "arm".
  for (const p of PLACEMENT_BY_SPECIFICITY) {
    if (norm.includes(p) || norm.includes(p.replace(/-/g, " "))) return p;
  }
  return "other";
}

export function toColorType(raw: unknown): ColorType {
  const norm = normalizeText(raw);
  if (!norm) return "unknown";
  if (COLOR_ALIASES[norm]) return COLOR_ALIASES[norm];
  if (norm.includes("black") && (norm.includes("grey") || norm.includes("gray"))) {
    return "black_grey";
  }
  if (norm.includes("color") || norm.includes("colour")) return "color";
  return "unknown";
}

export function toSizeEstimate(raw: unknown): SizeEstimate {
  const norm = normalizeText(raw);
  if (!norm) return "unknown";
  if (SIZE_ALIASES[norm]) return SIZE_ALIASES[norm];
  for (const key of Object.keys(SIZE_ALIASES)) {
    if (norm.includes(key)) return SIZE_ALIASES[key];
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// The structured tag set (post-mapping) + the loose vision output (pre-mapping).
// ---------------------------------------------------------------------------
export interface StyleTag {
  slug: string;
  confidence: number; // 0..1
}

export interface ImageTags {
  styles: StyleTag[]; // canonical slugs, dedup'd, sorted by confidence desc
  placement: string[]; // canonical placement vocab
  color_type: ColorType;
  size_estimate: SizeEstimate;
  subject_matter: string[]; // cleaned free-text nouns
  description: string; // short free-text scene description
}

/** The permissive shape a vision model is asked to emit (all fields optional). */
export interface RawVisionOutput {
  styles?: unknown; // array of {slug|name, confidence} OR array of strings
  placement?: unknown; // array of strings OR string
  color_type?: unknown; // string
  size_estimate?: unknown; // string
  subject_matter?: unknown; // array of strings OR string
  description?: unknown; // string
}

function asStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string") as string[];
  if (typeof raw === "string") return raw.split(/[,;]+/).map((s) => s.trim());
  return [];
}

function clampConfidence(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return n > 1 && n <= 100 ? n / 100 : 1; // tolerate 0..100 scale
  return n;
}

/**
 * Map a loose vision output onto the canonical taxonomy. Pure + total: never
 * throws, unknown labels are dropped (styles/placement) or bucketed ("other"),
 * confidences are clamped to 0..1, styles are dedup'd (max confidence wins) and
 * sorted by confidence desc.
 */
export function mapVisionTags(raw: RawVisionOutput): ImageTags {
  // styles: accept [{slug|name, confidence}] or bare strings.
  const styleMap = new Map<string, number>();
  if (Array.isArray(raw.styles)) {
    for (const entry of raw.styles) {
      let label: unknown;
      let conf = 0.6;
      if (entry && typeof entry === "object") {
        const o = entry as Record<string, unknown>;
        label = o.slug ?? o.name ?? o.style ?? o.label;
        conf = clampConfidence(o.confidence ?? o.score ?? o.weight);
      } else {
        label = entry;
      }
      const slug = toCanonicalStyle(label);
      if (!slug) continue;
      const prev = styleMap.get(slug);
      if (prev === undefined || conf > prev) styleMap.set(slug, conf);
    }
  }
  const styles: StyleTag[] = [...styleMap.entries()]
    .map(([slug, confidence]) => ({ slug, confidence }))
    .sort((a, b) => b.confidence - a.confidence || a.slug.localeCompare(b.slug));

  // placement: canonical vocab, dedup, drop nothing (unknowns -> "other").
  const placementSet = new Set<string>();
  for (const p of asStringArray(raw.placement)) {
    const canon = toCanonicalPlacement(p);
    if (canon) placementSet.add(canon);
  }
  const placement = [...placementSet];

  // subject_matter: cleaned lowercase nouns, dedup, capped.
  const subjectSet = new Set<string>();
  for (const s of asStringArray(raw.subject_matter)) {
    const norm = normalizeText(s);
    if (norm) subjectSet.add(norm);
  }
  const subject_matter = [...subjectSet].slice(0, 24);

  return {
    styles,
    placement,
    color_type: toColorType(raw.color_type),
    size_estimate: toSizeEstimate(raw.size_estimate),
    subject_matter,
    description: typeof raw.description === "string" ? raw.description.slice(0, 600) : "",
  };
}

// ---------------------------------------------------------------------------
// Deterministic feature-hashing helpers (FNV-1a 32-bit).
// ---------------------------------------------------------------------------
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Signed feature hashing of tokens into [base, base+dim). Sign from a 2nd hash. */
function hashTokens(
  vec: number[],
  tokens: string[],
  base: number,
  dim: number,
  weight: number,
): void {
  if (dim <= 0 || tokens.length === 0) return;
  for (const tok of tokens) {
    if (!tok) continue;
    const h = fnv1a(tok);
    const idx = h % dim;
    const sign = (fnv1a("s:" + tok) & 1) === 0 ? 1 : -1;
    vec[base + idx] += sign * weight;
  }
}

/**
 * Build the deterministic semantic-fingerprint embedding from mapped tags.
 * L2-normalized so a zero-vector-safe cosine similarity ranks similar works.
 * Reproducible byte-for-byte from the same ImageTags. See EMBEDDING APPROACH.
 */
export function buildImageVector(tags: ImageTags): number[] {
  const v = new Array<number>(VECTOR_DIM).fill(0);

  // styles: confidence-weighted per canonical slot.
  for (const { slug, confidence } of tags.styles) {
    const i = STYLE_INDEX.get(slug);
    if (i !== undefined) v[OFF_STYLE + i] = W_STYLE * confidence;
  }

  // placement: multi-hot.
  for (const p of tags.placement) {
    const i = PLACEMENT_INDEX.get(p);
    if (i !== undefined) v[OFF_PLACEMENT + i] += W_PLACEMENT;
  }

  // color: [color, black_grey, both, unknown] with "both" splitting the mass.
  switch (tags.color_type) {
    case "color":
      v[OFF_COLOR + 0] = W_COLOR;
      break;
    case "black_grey":
      v[OFF_COLOR + 1] = W_COLOR;
      break;
    case "both":
      v[OFF_COLOR + 0] = W_COLOR * 0.7071;
      v[OFF_COLOR + 1] = W_COLOR * 0.7071;
      v[OFF_COLOR + 2] = W_COLOR;
      break;
    default:
      break; // "unknown" = absence of info -> no signal (keeps zero-vector clean)
  }

  // size: one-hot small/medium/large ("unknown" contributes nothing).
  switch (tags.size_estimate) {
    case "small":
      v[OFF_SIZE + 0] = W_SIZE;
      break;
    case "medium":
      v[OFF_SIZE + 1] = W_SIZE;
      break;
    case "large":
      v[OFF_SIZE + 2] = W_SIZE;
      break;
    default:
      break;
  }

  // subject_matter: signed feature hashing (each multi-word subject also split
  // into its word tokens so "koi fish" contributes koi + fish + koi-fish).
  const subjectTokens: string[] = [];
  for (const s of tags.subject_matter) {
    subjectTokens.push(s);
    for (const w of s.split(" ")) if (w.length > 2) subjectTokens.push(w);
  }
  hashTokens(v, subjectTokens, OFF_SUBJECT, SUBJECT_DIM, W_SUBJECT);

  // description: hash content words (>3 chars) for a soft free-text signal.
  const descTokens = normalizeText(tags.description)
    .split(" ")
    .filter((w) => w.length > 3);
  hashTokens(v, descTokens, OFF_DESC, DESC_DIM, W_DESC);

  // L2 normalize (guard the all-zero case).
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

/** True when every component is zero (e.g. a "not a tattoo" / untaggable image).
 * The caller stores NULL rather than a zero vector, since cosine distance to a
 * zero vector is undefined — such rows are simply excluded from similarity. */
export function isZeroVector(vec: number[]): boolean {
  return vec.every((x) => x === 0);
}

/** Cosine similarity of two equal-length vectors (both assumed L2-normalized). */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

/** Format a JS number[] as a pgvector literal string: "[0.1,0.2,...]". */
export function toPgVectorLiteral(vec: number[]): string {
  return "[" + vec.map((x) => (Number.isFinite(x) ? x.toFixed(6) : "0")).join(",") + "]";
}

// ---------------------------------------------------------------------------
// Vision prompt + strict parse. The prompt pins the model to the canonical
// style slugs so its output maps cleanly; parseVisionResponse tolerates code
// fences / stray prose and extracts the single JSON object.
// ---------------------------------------------------------------------------
export function buildVisionSystemPrompt(): string {
  return [
    "You are INKD's tattoo image classifier. Given ONE tattoo photo, classify it",
    "into structured attributes for a discovery + visual-similarity search engine.",
    "",
    "Respond with ONLY a single JSON object (no prose, no code fence) of shape:",
    "{",
    '  "styles": [{ "slug": "<one of the allowed slugs>", "confidence": 0.0-1.0 }],',
    '  "placement": ["<body placement words, e.g. forearm, back, ribs>"],',
    '  "color_type": "color" | "black_grey" | "both" | "unknown",',
    '  "size_estimate": "small" | "medium" | "large" | "unknown",',
    '  "subject_matter": ["<short nouns for what is depicted, e.g. rose, skull, koi>"],',
    '  "description": "<one concise sentence describing the tattoo>"',
    "}",
    "",
    "Rules:",
    "- styles: pick 1-3 from the ALLOWED SLUGS below, most-likely first, honest",
    "  confidences. Never invent a slug outside the list.",
    "- If the image is not a tattoo, return empty styles and description \"not a tattoo\".",
    "- color_type: black_grey = only black/grey ink; color = has colored ink; both =",
    "  a mix across the piece.",
    "- size_estimate: rough physical scale on the body (small<3in, large=sleeve/back).",
    "",
    "ALLOWED SLUGS: " + STYLE_SLUGS.join(", "),
  ].join("\n");
}

export function parseVisionResponse(raw: string): RawVisionOutput {
  const text = (raw ?? "").trim();
  // strip a leading/trailing code fence if present.
  const fenced = text.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("vision response contained no JSON object");
  }
  const slice = fenced.slice(start, end + 1);
  const parsed = JSON.parse(slice) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("vision response JSON was not an object");
  }
  return parsed as RawVisionOutput;
}

/** One-shot: raw model text -> canonical tags + embedding. */
export function tagsFromVisionResponse(raw: string): {
  tags: ImageTags;
  embedding: number[];
} {
  const tags = mapVisionTags(parseVisionResponse(raw));
  return { tags, embedding: buildImageVector(tags) };
}

export const MODEL_VERSION = "inkd-tagfp-v1";
