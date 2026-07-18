"use client";

/**
 * Dev-only preview harness for the global SEARCH overlay (⌘K). Renders the REAL
 * `SearchOverlay` against an in-memory mock client that answers the two search
 * RPCs (search_artists / search_shops) and the styles taxonomy, because this
 * sandbox blocks egress to the live Supabase project. Never linked from nav.
 */
import { useMemo } from "react";
import { InkdProvider } from "@inkd/core/hooks";
import { Icon } from "@inkd/ui/web";
import type { InkdSupabaseClient } from "@inkd/core/supabase";
import { SearchOverlay } from "@/components/search/SearchOverlay";

const ARTISTS = [
  { artist_id: "a1", handle: "desmond-wright", display_name: "Desmond Wright", avatar_url: null, styles: ["black-and-grey", "portrait", "realism"], city: "Baltimore", state: "MD" },
  { artist_id: "a2", handle: "priya-anand", display_name: "Priya Anand", avatar_url: null, styles: ["fine-line", "micro-realism"], city: "Philadelphia", state: "PA" },
  { artist_id: "a3", handle: "nova-reyes", display_name: "Nova Reyes", avatar_url: null, styles: ["neo-traditional", "realism"], city: "Baltimore", state: "MD" },
];
const SHOPS = [
  { shop_id: "s1", handle: "fells-point-ink", name: "Fells Point Ink", bio: null, avatar_url: null, city: "Baltimore", state: "MD", member_count: 3 },
];
const STYLES = [
  { id: "st1", slug: "realism", name: "Realism", sort_order: 1 },
  { id: "st2", slug: "micro-realism", name: "Micro Realism", sort_order: 2 },
  { id: "st3", slug: "fine-line", name: "Fine Line", sort_order: 3 },
  { id: "st4", slug: "black-and-grey", name: "Black & Grey", sort_order: 4 },
  { id: "st5", slug: "neo-traditional", name: "Neo Traditional", sort_order: 5 },
];

function match(q: string, hay: string) {
  return hay.toLowerCase().includes(q.trim().toLowerCase());
}

function createSearchMock(): InkdSupabaseClient {
  const client = {
    from(table: string) {
      const rows = table === "styles" ? STYLES : [];
      const builder = {
        select: () => builder,
        order: () => Promise.resolve({ data: rows, error: null }),
        then: (res: (v: { data: unknown[]; error: null }) => void) =>
          res({ data: rows, error: null }),
      };
      return builder;
    },
    async rpc(fn: string, args?: Record<string, unknown>) {
      const q = String(args?.p_query ?? "");
      if (fn === "search_artists") {
        const data = ARTISTS.filter(
          (a) => match(q, a.display_name) || match(q, a.handle) || a.styles.some((s) => match(q, s)),
        );
        return { data, error: null };
      }
      if (fn === "search_shops") {
        const data = SHOPS.filter((s) => match(q, s.name) || match(q, s.handle));
        return { data, error: null };
      }
      return { data: [], error: null };
    },
    auth: {
      async getUser() {
        return { data: { user: null }, error: null };
      },
      async getSession() {
        return { data: { session: null }, error: null };
      },
    },
  };
  return client as unknown as InkdSupabaseClient;
}

export default function SearchPreviewPage() {
  const client = useMemo(() => createSearchMock(), []);
  return (
    <InkdProvider client={client}>
      <div className="min-h-dvh bg-surface-base">
        {/* Mock header chrome so the dropdown anchors under a top-right search
            control exactly as it does in the real app TopBar. */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border-subtle bg-surface-chrome/85 px-5 backdrop-blur md:px-8">
          <span className="font-display text-xl font-bold tracking-tight">INKD</span>
          <div className="relative ml-auto">
            <div className="hidden h-10 items-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 text-content-muted md:flex">
              <Icon name="search" size={16} />
              <span className="text-sm">Search</span>
              <kbd className="ml-6 rounded border border-border-subtle bg-surface-overlay px-1.5 py-0.5 font-mono text-[10px] text-content-secondary">
                ⌘K
              </kbd>
            </div>
            <SearchOverlay open onClose={() => {}} initialQuery="real" />
          </div>
        </header>
        {/* A faint page behind the dropdown so it reads as an overlay panel. */}
        <div className="mx-auto w-full max-w-6xl px-8 py-10 opacity-40">
          <div className="h-8 w-40 rounded bg-surface-raised" />
          <div className="mt-6 grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-sm bg-surface-raised" />
            ))}
          </div>
        </div>
      </div>
    </InkdProvider>
  );
}
