/**
 * A discovery result rendered as a museum placard: a hard-edged solid plate,
 * name in the display face, distance + price in the mono "data" voice, and
 * "BOOKS OPEN" struck as a solid stamp. The whole card links to the artist's
 * public profile. Used by the /discover list and the map popover.
 */
import Link from "next/link";
import { Avatar, Icon } from "@inkd/ui/web";
import { cx } from "@inkd/ui/web";
import { formatMinPrice, type ArtistCard } from "@inkd/core/api";

const CLASSIFICATION_LABEL: Record<string, string> = {
  shop_owner: "Shop owner",
  shop_resident: "Resident",
  private_suite: "Private suite",
  independent: "Independent",
};

function styleLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface ArtistPlacardProps {
  card: ArtistCard;
  /** Highlight when its map pin is hovered/active. */
  active?: boolean;
  onHover?: (artistId: string | null) => void;
  className?: string;
}

export function ArtistPlacard({ card, active, onHover, className }: ArtistPlacardProps) {
  const price = formatMinPrice(card.min_price_cents);
  const distance =
    card.distance_km != null ? `${card.distance_km.toFixed(1)} km` : null;
  const styles = card.styles.slice(0, 3);
  const extraStyles = card.styles.length - styles.length;

  return (
    <Link
      href={`/a/${card.handle}`}
      onMouseEnter={() => onHover?.(card.artist_id)}
      onMouseLeave={() => onHover?.(null)}
      className={cx(
        "group flex flex-col gap-3 rounded-sm border bg-surface-raised p-4 transition-colors",
        active
          ? "border-border-accent"
          : "border-border-subtle hover:border-border-strong",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar src={card.avatar_url ?? undefined} name={card.display_name} size="lg" shape="square" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate font-display text-lg font-bold tracking-tight text-content-primary">
              {card.display_name}
            </h3>
            {distance && (
              <span className="shrink-0 font-mono text-xs uppercase tracking-wider text-content-muted">
                {distance}
              </span>
            )}
          </div>
          <p className="truncate font-mono text-xs text-content-muted">@{card.handle}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-content-secondary">
            <Icon name="map-pin" size={12} />
            <span className="truncate">
              {[card.city, card.state].filter(Boolean).join(", ") || "Location private"}
            </span>
            {card.classification && CLASSIFICATION_LABEL[card.classification] && (
              <span className="text-content-muted">· {CLASSIFICATION_LABEL[card.classification]}</span>
            )}
          </p>
        </div>
      </div>

      {styles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {styles.map((s) => (
            <span
              key={s}
              className="rounded-sm border border-border-subtle bg-surface-overlay px-2 py-0.5 text-xs text-content-secondary"
            >
              {styleLabel(s)}
            </span>
          ))}
          {extraStyles > 0 && (
            <span className="rounded-sm px-2 py-0.5 text-xs text-content-muted">
              +{extraStyles}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-2">
          {card.books_open ? (
            <span className="rounded-sm bg-brand px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-brand-on">
              Books open
            </span>
          ) : (
            <span className="rounded-sm border border-border-default px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-content-muted">
              Books closed
            </span>
          )}
          {card.has_active_flash && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-surface-ember px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-brand-on-ember">
              <Icon name="sparkles" size={11} /> Flash
            </span>
          )}
        </div>
        {price ? (
          <span className="font-hand text-lg leading-none text-content-ember" title="Starting price">
            from {price}
          </span>
        ) : (
          <span className="font-mono text-xs uppercase tracking-wider text-content-muted">
            By quote
          </span>
        )}
      </div>
    </Link>
  );
}
