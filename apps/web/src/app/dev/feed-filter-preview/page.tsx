"use client";

/**
 * Dev-only preview harness for the FEED FILTER panel + active-filter chips.
 * Renders the REAL `FeedFilterPanel` with a preset filter state (styles + city +
 * price + open books) plus the inline active-chip row, so both can be captured
 * without a live backend. Never linked from product nav.
 */
import { useState } from "react";
import { Icon } from "@inkd/ui/web";
import {
  describeFeedFilters,
  clearFeedFilterChip,
  EMPTY_FEED_FILTER,
  type FeedFilterState,
} from "@inkd/core";
import type { Style } from "@inkd/core/types";
import { FeedFilterPanel } from "@/components/feed/FeedFilterPanel";

const STYLES = [
  { id: "st1", slug: "realism", name: "Realism", sort_order: 1 },
  { id: "st2", slug: "fine-line", name: "Fine Line", sort_order: 2 },
  { id: "st3", slug: "black-and-grey", name: "Black & Grey", sort_order: 3 },
  { id: "st4", slug: "neo-traditional", name: "Neo Traditional", sort_order: 4 },
  { id: "st5", slug: "japanese", name: "Japanese", sort_order: 5 },
  { id: "st6", slug: "traditional", name: "Traditional", sort_order: 6 },
  { id: "st7", slug: "blackwork", name: "Blackwork", sort_order: 7 },
  { id: "st8", slug: "dotwork", name: "Dotwork", sort_order: 8 },
  { id: "st9", slug: "watercolor", name: "Watercolor", sort_order: 9 },
  { id: "st10", slug: "tribal", name: "Tribal", sort_order: 10 },
  { id: "st11", slug: "illustrative", name: "Illustrative", sort_order: 11 },
  { id: "st12", slug: "lettering", name: "Lettering", sort_order: 12 },
] as unknown as Style[];

const PRESET: FeedFilterState = {
  city: "baltimore",
  lat: 39.2904,
  lng: -76.6122,
  state: "MD",
  radiusKm: 40,
  styles: ["fine-line", "realism"],
  priceMinUsd: undefined,
  priceMaxUsd: 400,
  booksOpen: true,
  query: "",
};

export default function FeedFilterPreviewPage() {
  const [filter, setFilter] = useState<FeedFilterState>(PRESET);
  const chips = describeFeedFilters(filter, STYLES);

  return (
    <div className="min-h-dvh bg-surface-base p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <h1 className="font-display text-2xl font-extrabold text-content-primary">New work</h1>

        {/* Active-filter chips (matches the FeedScreen inline row) */}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(clearFeedFilterChip(filter, chip))}
                className="inline-flex items-center gap-1 rounded-sm border border-brand/40 bg-brand/10 px-2 py-1 text-xs font-medium text-content-primary"
              >
                {chip.label}
                <Icon name="x" size={12} className="text-content-muted" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFilter(EMPTY_FEED_FILTER)}
              className="ml-1 font-mono text-[11px] uppercase tracking-wider text-content-muted"
            >
              Clear all
            </button>
          </div>
        )}

        {/* The panel, rendered open */}
        <div className="w-fit">
          <FeedFilterPanel
            filter={filter}
            styles={STYLES}
            onChange={setFilter}
            onReset={() => setFilter(EMPTY_FEED_FILTER)}
            onClose={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
