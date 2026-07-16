"use client";

/**
 * Discovery's SHOP dimension — additive to the artist search. A horizontal
 * strip of shop cards; each expands in place to reveal the shop's roster, every
 * artist linking to their /a/[handle]. Reuses the RLS-respecting `search_shops`
 * RPC and shares the state/query filter with the artist search so the two
 * dimensions stay in sync without touching `search_artists`.
 */
import { useState } from "react";
import Link from "next/link";
import { Avatar, Badge, Icon, Spinner } from "@inkd/ui/web";
import {
  useActiveShopMembers,
  useShopSearch,
  type UsState,
  type ShopCard,
} from "@inkd/core";

export function ShopStrip({ state, query }: { state?: UsState; query?: string }) {
  const { data: shops = [], isLoading } = useShopSearch({
    state,
    query: query && query.length > 0 ? query : undefined,
  });

  if (isLoading || shops.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-b border-border-subtle pb-4">
      <div className="flex items-center gap-2">
        <Icon name="layout-grid" size={14} className="text-content-accent" />
        <span className="font-mono text-xs font-semibold uppercase tracking-widest text-content-secondary">
          Shops ({shops.length})
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {shops.map((shop) => (
          <ShopStripCard key={shop.shop_id} shop={shop} />
        ))}
      </div>
    </div>
  );
}

function ShopStripCard({ shop }: { shop: ShopCard }) {
  const [expanded, setExpanded] = useState(false);
  const { data: members = [], isLoading } = useActiveShopMembers(expanded ? shop.shop_id : undefined);
  const roster = members.filter((m) => m.role !== "owner");

  return (
    <div className="rounded-sm border border-border-subtle bg-surface-raised">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left"
        aria-expanded={expanded}
      >
        <Avatar src={shop.avatar_url ?? undefined} name={shop.name} size="md" shape="square" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold text-content-primary">{shop.name}</span>
          <span className="truncate font-mono text-xs text-content-muted">
            {[shop.city, shop.state].filter(Boolean).join(", ") || `@${shop.handle}`}
          </span>
        </span>
        <Badge variant="neutral" size="sm">
          <Icon name="user" size={12} />
          {shop.member_count}
        </Badge>
        <Icon name={expanded ? "chevron-down" : "chevron-right"} size={16} className="text-content-muted" />
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-border-subtle p-3">
          <Link href={`/s/${shop.handle}`} className="text-xs font-medium text-content-accent hover:underline">
            View shop page →
          </Link>
          {isLoading ? (
            <Spinner size={16} />
          ) : roster.length === 0 ? (
            <span className="text-xs text-content-muted">No artists listed yet.</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {roster.map((m) => {
                const p = m.artist?.profile;
                const name = p?.display_name || (p?.handle ? `@${p.handle}` : "Artist");
                return (
                  <Link
                    key={m.id}
                    href={p?.handle ? `/a/${p.handle}` : "#"}
                    className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface-overlay px-2.5 py-1 transition-colors hover:border-border-accent"
                  >
                    <Avatar src={p?.avatar_url ?? undefined} name={name} size="xs" />
                    <span className="text-xs font-medium text-content-secondary">{name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
