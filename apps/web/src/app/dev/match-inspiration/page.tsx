"use client";

/**
 * Offline dev harness for "Match my inspiration". Renders the REAL presentation
 * components (DetectedTagsPanel, MatchResultsGallery, MatchArtistCard) against
 * seeded tags + similar_works rows run through the REAL pure logic
 * (describeInspiration / groupSimilarWorks / classifyMatchOutcome) — no live
 * Supabase, no InkdProvider. Lets us build + screenshot every state in
 * isolation. Not linked from product nav.
 */
import { useMemo, useState } from "react";
import { Icon } from "@inkd/ui/web";
import {
  describeInspiration,
  groupSimilarWorks,
  classifyMatchOutcome,
  type ArtistBrief,
  type ImageTagResult,
  type SimilarWork,
} from "@inkd/core/api";

import { DetectedTagsPanel } from "@/components/discover/match/DetectedTagsPanel";
import { MatchResultsGallery } from "@/components/discover/match/MatchResultsGallery";

// A fine-line + floral, black & grey forearm inspiration (mirrors the seeded DB
// demo the live flow returns).
const TAGS: ImageTagResult = {
  styles: [
    { slug: "fine-line", confidence: 0.94 },
    { slug: "floral-botanical", confidence: 0.88 },
    { slug: "illustrative", confidence: 0.41 },
  ],
  placement: ["forearm"],
  color_type: "black_grey",
  size_estimate: "medium",
  subject_matter: ["rose", "stem", "leaves"],
  description: "a delicate single-needle rose with fine botanical linework",
};

const NO_STYLE_TAGS: ImageTagResult = {
  styles: [],
  placement: [],
  color_type: "unknown",
  size_estimate: "unknown",
  subject_matter: [],
  description: "a blurry photo with no clear tattoo",
};

const ARTISTS: ArtistBrief[] = [
  { artistId: "a1", profileId: "p1", handle: "demo-booking-jayden", displayName: "Jayden Cole", avatarUrl: null },
  { artistId: "a2", profileId: "p2", handle: "demo-folio-nova", displayName: "Nova Reyes", avatarUrl: null },
  { artistId: "a3", profileId: "p3", handle: "priya-anand", displayName: "Priya Anand", avatarUrl: null },
];

function work(o: Partial<SimilarWork> & Pick<SimilarWork, "artist_id" | "subject_id" | "similarity">): SimilarWork {
  return {
    subject_type: "post",
    image_url: null,
    styles: ["fine-line", "floral-botanical"],
    color_type: "black_grey",
    ...o,
  };
}

// Ranked rows mirroring the live similar_works proof.
const ROWS_STRONG: SimilarWork[] = [
  work({ artist_id: "a1", subject_id: "j1", similarity: 1.0 }),
  work({ artist_id: "a1", subject_id: "j2", similarity: 1.0 }),
  work({ artist_id: "a1", subject_id: "j3", subject_type: "flash_item", similarity: 0.946 }),
  work({ artist_id: "a2", subject_id: "n1", subject_type: "flash_item", styles: ["floral-botanical", "fine-line"], color_type: "color", similarity: 0.737 }),
  work({ artist_id: "a2", subject_id: "n2", styles: ["floral-botanical", "watercolor"], similarity: 0.609 }),
  work({ artist_id: "a2", subject_id: "n3", styles: ["floral-botanical", "illustrative"], similarity: 0.582 }),
  work({ artist_id: "a3", subject_id: "p1", styles: ["fine-line", "micro-realism"], similarity: 0.556 }),
];

const ROWS_LOW: SimilarWork[] = [
  work({ artist_id: "a3", subject_id: "p1", styles: ["fine-line"], similarity: 0.44 }),
  work({ artist_id: "a2", subject_id: "n3", styles: ["floral-botanical", "illustrative"], similarity: 0.41 }),
];

type State = "results" | "low" | "nostyle";

export default function DevMatchInspirationPage() {
  const [state, setState] = useState<State>("results");
  const [refine, setRefine] = useState<string[]>([]);

  const view = useMemo(() => {
    if (state === "nostyle") {
      const summary = describeInspiration(NO_STYLE_TAGS);
      return { summary, groups: [], outcome: classifyMatchOutcome(summary, []) };
    }
    const summary = describeInspiration(TAGS);
    const rows = state === "low" ? ROWS_LOW : ROWS_STRONG;
    const activeSlugs = summary.styles.map((s) => s.slug);
    const filtered = refine.length ? rows.filter((r) => r.styles.some((s) => refine.includes(s))) : rows;
    const groups = groupSimilarWorks(filtered, new Map(ARTISTS.map((a) => [a.artistId, a])), {
      inspirationStyleSlugs: activeSlugs,
      inspirationColorLabel: summary.colorLabel,
    });
    return { summary, groups, outcome: classifyMatchOutcome(summary, groups) };
  }, [state, refine]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="w-fit rounded-full border border-border-subtle bg-surface-overlay px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-content-muted">
            Dev harness · offline
          </span>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
            Match my inspiration
          </h1>
        </div>
        <div className="flex gap-2">
          {(["results", "low", "nostyle"] as State[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setState(s); setRefine([]); }}
              className={
                "rounded-sm border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest " +
                (state === s
                  ? "border-brand bg-brand text-brand-on"
                  : "border-border-subtle bg-surface-raised text-content-secondary")
              }
            >
              {s === "results" ? "Strong" : s === "low" ? "Low match" : "No style"}
            </button>
          ))}
        </div>
      </header>

      {/* Static upload entry (visual) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className="flex flex-1 items-center gap-3 rounded-sm border border-dashed border-border-default bg-surface-raised p-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-sm bg-surface-overlay text-content-ember">
            <Icon name="image" size={28} />
          </div>
          <div>
            <p className="font-display text-sm font-bold text-content-primary">Your inspiration</p>
            <p className="text-xs text-content-secondary">Analyzed — not stored.</p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-sm border border-border-subtle bg-surface-overlay p-3 sm:max-w-[15rem]">
          <span className="mt-0.5 text-content-muted"><Icon name="sparkles" size={14} /></span>
          <p className="text-xs leading-relaxed text-content-secondary">
            Your image is read on the fly and <span className="text-content-primary">never stored</span>.
          </p>
        </div>
      </div>

      <DetectedTagsPanel
        summary={view.summary}
        activeStyleSlugs={refine}
        onToggleStyle={(slug) =>
          setRefine((r) =>
            slug === "__reset__" ? [] : r.includes(slug) ? r.filter((x) => x !== slug) : [...r, slug],
          )
        }
      />

      <MatchResultsGallery
        outcome={view.outcome}
        groups={view.groups}
        summary={view.summary}
        onTryAnother={() => setState("results")}
      />
    </div>
  );
}
