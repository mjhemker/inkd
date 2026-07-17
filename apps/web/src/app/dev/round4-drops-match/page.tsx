"use client";

/**
 * Dev-only OFFLINE preview harness for the Round 4 Daily Drop reveal + Match
 * fallback work (screenshots). Renders the REAL components against hand-built
 * demo props + the daily-drop mock Supabase client, so nothing touches the
 * network. Switch state with `?view=`: reveal | card | match-ok | match-fallback.
 * Never linked from product nav.
 */
import { useEffect, useMemo, useState } from "react";
import { InkdProvider } from "@inkd/core/hooks";
import type { DailyDropCard as DailyDropCardData } from "@inkd/core";
import type {
  InspirationSummary,
  MatchArtistGroup,
  MatchOutcome,
} from "@inkd/core/api";
import { DailyDropCard } from "@/components/daily-drop/DailyDropCard";
import { DailyDropReveal } from "@/components/daily-drop/DailyDropReveal";
import { DetectedTagsPanel } from "@/components/discover/match/DetectedTagsPanel";
import { MatchResultsGallery } from "@/components/discover/match/MatchResultsGallery";
import { createDropMockClient } from "../daily-drop-preview/dropMockClient";
import { dailyDropDemoSeed } from "../daily-drop-preview/dropSeed";

const TODAY = new Date().toISOString().slice(0, 10);

const REVEAL_CARD: DailyDropCardData = {
  id: "drop-preview",
  dropDate: TODAY,
  reason: "Because you follow artists who work in Blackwork",
  reasonStyle: "blackwork",
  isColdStart: false,
  seenAt: null,
  clickedAt: null,
  reactedAt: null,
  subjectType: "flash",
  subjectId: "f-dagger",
  artist: {
    artistId: "art-mara",
    profileId: "prof-mara",
    handle: "maravance",
    displayName: "Mara Vance",
    avatarUrl: null,
    city: "Brooklyn",
    state: "NY",
    styles: ["Blackwork", "Illustrative"],
    acceptsNewClients: true,
    isFollowedByViewer: true,
  },
  flash: {
    flashSheetId: "fs-mara",
    imageUrl: null,
    title: "Ember dagger",
    priceCents: 18000,
    isAvailable: true,
    isRepeatable: false,
    placementSuggestion: "forearm",
    sizeInches: 4,
    styleTags: [{ id: "st-black", slug: "blackwork", name: "Blackwork" }],
  },
};

const SUMMARY: InspirationSummary = {
  styles: [
    { slug: "fine-line", label: "Fine Line", confidence: 0.86 },
    { slug: "floral-botanical", label: "Floral Botanical", confidence: 0.54 },
  ],
  placement: ["forearm"],
  colorType: "black_grey",
  colorLabel: "Black & grey",
  sizeEstimate: "medium",
  subjects: ["rose", "leaves"],
  description: "a delicate fine-line rose with botanical detail",
  hasClearStyle: true,
};

const OK_GROUPS: MatchArtistGroup[] = [
  {
    artistId: "art-dex",
    handle: "dexokafor",
    displayName: "Dex Okafor",
    avatarUrl: null,
    profileHref: "/a/dexokafor",
    works: [
      { subjectType: "post", subjectId: "w1", imageUrl: null, styles: ["fine-line"], colorType: "black_grey", similarity: 0.83, similarityPercent: 83 },
      { subjectType: "post", subjectId: "w2", imageUrl: null, styles: ["fine-line", "floral-botanical"], colorType: "black_grey", similarity: 0.79, similarityPercent: 79 },
    ],
    topSimilarity: 0.83,
    topSimilarityPercent: 83,
    matchLabel: "Strong match",
    matchReason: "Fine Line + Floral Botanical, like your inspiration",
    sharedStyleLabels: ["Fine Line", "Floral Botanical"],
  },
  {
    artistId: "art-priya",
    handle: "priya-anand",
    displayName: "Priya Anand",
    avatarUrl: null,
    profileHref: "/a/priya-anand",
    works: [
      { subjectType: "post", subjectId: "w3", imageUrl: null, styles: ["fine-line"], colorType: "black_grey", similarity: 0.71, similarityPercent: 71 },
    ],
    topSimilarity: 0.71,
    topSimilarityPercent: 71,
    matchLabel: "Close match",
    matchReason: "Fine Line, like your inspiration",
    sharedStyleLabels: ["Fine Line"],
  },
];

const FALLBACK_GROUPS: MatchArtistGroup[] = [
  {
    artistId: "art-nova",
    handle: "demo-folio-nova",
    displayName: "Nova Reyes",
    avatarUrl: null,
    profileHref: "/a/demo-folio-nova",
    works: [
      { subjectType: "post", subjectId: "n1", imageUrl: null, styles: [], colorType: "unknown", similarity: 0, similarityPercent: 0 },
      { subjectType: "post", subjectId: "n2", imageUrl: null, styles: [], colorType: "unknown", similarity: 0, similarityPercent: 0 },
    ],
    topSimilarity: 0,
    topSimilarityPercent: 0,
    matchLabel: "Nearby",
    matchReason: "Fine Line + Floral Botanical, like your inspiration",
    sharedStyleLabels: ["Fine Line", "Floral Botanical"],
    isAffinityFallback: true,
  },
  {
    artistId: "art-marcus",
    handle: "marcus-vane",
    displayName: "Marcus Vane",
    avatarUrl: null,
    profileHref: "/a/marcus-vane",
    works: [
      { subjectType: "post", subjectId: "m1", imageUrl: null, styles: [], colorType: "unknown", similarity: 0, similarityPercent: 0 },
    ],
    topSimilarity: 0,
    topSimilarityPercent: 0,
    matchLabel: "Nearby",
    matchReason: "Blackwork + American Traditional — a related aesthetic",
    sharedStyleLabels: [],
    isAffinityFallback: true,
  },
];

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-content-muted">{title}</p>
      {children}
    </div>
  );
}

export default function Round4Preview() {
  const [view, setView] = useState("reveal");
  useEffect(() => {
    setView(new URLSearchParams(window.location.search).get("view") ?? "reveal");
  }, []);
  const client = useMemo(() => createDropMockClient(dailyDropDemoSeed), []);

  return (
    <InkdProvider client={client}>
      <div className="min-h-dvh bg-surface-base">
        {view === "reveal" && <DailyDropReveal card={REVEAL_CARD} onDismiss={() => {}} />}

        {view === "card" && (
          <Frame title="Daily Drop · highlighted card atop the feed">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-content-ember">
                Today&apos;s drop
              </span>
              <DailyDropCard card={REVEAL_CARD} variant="feed" signedIn />
            </div>
          </Frame>
        )}

        {(view === "match-ok" || view === "match-fallback") && (
          <Frame
            title={
              view === "match-ok"
                ? "Match my inspiration · results"
                : "Match my inspiration · style-affinity fallback"
            }
          >
            <div className="flex flex-col gap-5">
              <DetectedTagsPanel summary={SUMMARY} activeStyleSlugs={[]} onToggleStyle={() => {}} />
              <MatchResultsGallery
                outcome={(view === "match-ok" ? "ok" : "fallback") as MatchOutcome}
                groups={view === "match-ok" ? OK_GROUPS : FALLBACK_GROUPS}
                summary={SUMMARY}
                onTryAnother={() => {}}
              />
            </div>
          </Frame>
        )}
      </div>
    </InkdProvider>
  );
}
