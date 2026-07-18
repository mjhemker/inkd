"use client";

/**
 * BodyMap (web) — a tappable human-body diagram for choosing a tattoo
 * placement instead of typing "left forearm".
 *
 * Controlled: pass `value` (a structured `{ region, side, view }`) and
 * `onChange`. Geometry, the region set, laterality, and labels all come from
 * `../bodyMap/regions`, so this file is purely the React/SVG presentation of
 * that shared model — the native renderer draws the exact same figure.
 *
 * Accessibility: every region is a focusable element with `role="button"`,
 * an `aria-label` ("Left forearm"), and `aria-pressed`; Enter/Space select it.
 * A plain <select> fallback (on by default) gives keyboard/AT users and
 * fat-finger taps a non-spatial path to the same value.
 */
import { useId, useMemo, useState } from "react";
import { cx } from "../cx";
import {
  FIGURES,
  placementLabel,
  placementSelectOptions,
  encodeOption,
  decodeOption,
  samePlacement,
  type PlacementValue,
  type PlacementView,
  type RegionShape,
  type Shape,
} from "../bodyMap/regions";
import { SILHOUETTE_PATHS } from "../bodyMap/silhouette";

export interface BodyMapProps {
  value: PlacementValue | null;
  onChange: (value: PlacementValue) => void;
  /** Show the <select> fallback beneath the map. Default true. */
  showFallback?: boolean;
  className?: string;
  /** Accessible name for the whole control. */
  "aria-label"?: string;
}

/**
 * Theming. The figure fill/stroke are driven by CSS custom properties scoped to
 * `.inkd-bodymap` (see BodyMapStyle) so a single `[data-theme="light"]` flip
 * re-skins the silhouette. `--bm-figure-*` paints the realistic-figure artwork
 * (`SILHOUETTE_PATHS`) — a visible ink outline in both themes: light-on-ink for
 * dark, a mid-tone ink outline on the warm paper wall for light. Region hit
 * areas (`ShapeEl`) sit on top and are INVISIBLE at rest — they only pick up
 * `--bm-hover-*` on hover/focus, or `--bm-sel-*` when selected — so the
 * realistic figure reads cleanly and the old blocky region outlines don't
 * compete with it.
 */
const VAR = {
  base: { fill: "transparent", stroke: "transparent" },
  hover: { fill: "var(--bm-hover-fill)", stroke: "var(--bm-hover-stroke)" },
  selected: { fill: "var(--bm-sel-fill)", stroke: "var(--bm-sel-stroke)" },
} as const;

const FIGURE_VAR = { fill: "var(--bm-figure-fill)", stroke: "var(--bm-figure-stroke)" } as const;

/**
 * One <style> that declares the body-map palette variables and their light
 * override. Rendered inside every BodyMap / thumbnail; duplicate identical rules
 * across instances are harmless (the cascade dedupes them).
 */
function BodyMapStyle() {
  return (
    <style>{`
      .inkd-bodymap {
        --bm-figure-fill: rgba(250,250,250,0.06);
        --bm-figure-stroke: rgba(250,250,250,0.55);
        --bm-hover-fill: rgba(139,92,246,0.22);
        --bm-hover-stroke: #A78BFA;
        --bm-sel-fill: #7C3AED;
        --bm-sel-stroke: #C4B5FD;
        --bm-focus-stroke: #C4B5FD;
      }
      [data-theme="light"] .inkd-bodymap {
        --bm-figure-fill: rgba(28,25,23,0.08);
        --bm-figure-stroke: rgba(28,25,23,0.7);
        --bm-hover-fill: rgba(124,58,237,0.15);
        --bm-hover-stroke: #7C3AED;
        --bm-sel-fill: #7C3AED;
        --bm-sel-stroke: #4C1D95;
        --bm-focus-stroke: #6D28D9;
      }
    `}</style>
  );
}

/** The realistic-figure background artwork for a view; purely decorative
 * (`pointer-events: none`) — all interaction stays on the region shapes. */
function Silhouette({ view }: { view: PlacementView }) {
  return (
    <path
      d={SILHOUETTE_PATHS[view]}
      style={{ fill: FIGURE_VAR.fill, stroke: FIGURE_VAR.stroke, strokeWidth: 1.5 }}
      pointerEvents="none"
    />
  );
}

function ShapeEl({
  rs,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  rs: RegionShape;
  selected: boolean;
  hovered: boolean;
  onSelect: () => void;
  onHover: (on: boolean) => void;
}) {
  const tone = selected ? VAR.selected : hovered ? VAR.hover : VAR.base;
  const common = {
    role: "button" as const,
    tabIndex: 0,
    "aria-pressed": selected,
    "aria-label": placementLabel(rs),
    onClick: onSelect,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect();
      }
    },
    onMouseEnter: () => onHover(true),
    onMouseLeave: () => onHover(false),
    onFocus: () => onHover(true),
    onBlur: () => onHover(false),
    style: {
      fill: tone.fill,
      stroke: tone.stroke,
      strokeWidth: selected ? 2 : 1.5,
      cursor: "pointer",
      transition: "fill 120ms ease, stroke 120ms ease",
      outline: "none",
    } as React.CSSProperties,
    className:
      "focus-visible:[stroke:var(--bm-focus-stroke)] focus-visible:[stroke-width:2.5px]",
  };
  return renderShape(rs.shape, common);
}

function renderShape(shape: Shape, props: Record<string, unknown>) {
  // `key` must be a real JSX attribute (not spread) or React warns — callers
  // that need one (BodyMapThumbnail) pass it inside `props`; pull it out here.
  const { key, ...rest } = props as { key?: React.Key } & Record<string, unknown>;
  switch (shape.kind) {
    case "circle":
      return <circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} {...rest} />;
    case "ellipse":
      return <ellipse key={key} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...rest} />;
    case "rrect":
      return (
        <rect
          key={key}
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={shape.rx}
          {...rest}
        />
      );
  }
}

function ViewToggle({
  view,
  onChange,
}: {
  view: PlacementView;
  onChange: (v: PlacementView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Body view"
      className="inline-flex rounded-full border border-border-subtle bg-surface-raised p-1"
    >
      {(["front", "back"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={view === v}
          onClick={() => onChange(v)}
          className={cx(
            "rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand",
            view === v
              ? "bg-brand text-brand-on"
              : "text-content-secondary hover:text-content-primary",
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

export function BodyMap({
  value,
  onChange,
  showFallback = true,
  className,
  "aria-label": ariaLabel = "Tattoo placement — tap a region of the body",
}: BodyMapProps) {
  const [view, setView] = useState<PlacementView>(value?.view ?? "front");
  const [hover, setHover] = useState<string | null>(null);
  const selectId = useId();

  const figure = FIGURES[view];
  const selectedLabel = value ? placementLabel(value, { withView: value.view }) : null;
  const options = useMemo(() => placementSelectOptions(view), [view]);

  function select(rs: RegionShape) {
    onChange({ region: rs.region, side: rs.side, view });
  }

  return (
    <div className={cx("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <ViewToggle view={view} onChange={setView} />
        <span
          aria-live="polite"
          className="min-h-[1.5rem] text-right text-sm font-semibold text-content-primary"
        >
          {selectedLabel ?? (
            <span className="font-normal text-content-muted">No placement yet</span>
          )}
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-[260px]">
        <BodyMapStyle />
        <svg
          role="group"
          aria-label={ariaLabel}
          viewBox={`0 0 ${figure.viewBox.w} ${figure.viewBox.h}`}
          className="inkd-bodymap h-auto w-full select-none"
        >
          <Silhouette view={view} />
          {figure.regions.map((rs) => {
            const key = `${rs.region}:${rs.side ?? "-"}`;
            const isSel =
              !!value && samePlacement(value, { region: rs.region, side: rs.side, view });
            return (
              <ShapeEl
                key={key}
                rs={rs}
                selected={isSel}
                hovered={hover === key}
                onSelect={() => select(rs)}
                onHover={(on) => setHover(on ? key : (h) => (h === key ? null : h))}
              />
            );
          })}
        </svg>
      </div>

      {showFallback && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={selectId}
            className="font-mono text-[11px] uppercase tracking-widest text-content-muted"
          >
            Or pick from a list
          </label>
          <div className="relative">
            <select
              id={selectId}
              value={value && value.view === view ? encodeOption(value) : ""}
              onChange={(e) => {
                const next = decodeOption(e.target.value, view);
                if (next) onChange(next);
              }}
              className="h-10 w-full appearance-none rounded-sm border border-border bg-surface-raised pl-3 pr-9 text-sm text-content-primary outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <option value="" disabled>
                Choose a placement…
              </option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-content-muted">
              ▾
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * BodyMapThumbnail — a compact, non-interactive figure with one region
 * highlighted. Used artist-side so the placement is visible at a glance.
 */
export function BodyMapThumbnail({
  value,
  size = 96,
  className,
}: {
  value: PlacementValue;
  size?: number;
  className?: string;
}) {
  const figure = FIGURES[value.view];
  return (
    <>
      <BodyMapStyle />
      <svg
        viewBox={`0 0 ${figure.viewBox.w} ${figure.viewBox.h}`}
        width={size}
        height={(size * figure.viewBox.h) / figure.viewBox.w}
        className={cx("inkd-bodymap", className)}
        role="img"
        aria-label={`Placement: ${placementLabel(value, { withView: value.view })}`}
      >
        <Silhouette view={value.view} />
        {figure.regions.map((rs) => {
          const isSel = samePlacement(value, { region: rs.region, side: rs.side, view: value.view });
          const tone = isSel ? VAR.selected : VAR.base;
          return renderShape(rs.shape, {
            key: `${rs.region}:${rs.side ?? "-"}`,
            style: { fill: tone.fill, stroke: tone.stroke, strokeWidth: isSel ? 2 : 1 },
          });
        })}
      </svg>
    </>
  );
}
