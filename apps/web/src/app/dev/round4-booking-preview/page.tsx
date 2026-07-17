"use client";

/**
 * Dev-only offline harness for the Round-4 booking fixes (founder feedback):
 *   1. BodyMap silhouette theming (must read on light AND dark),
 *   2. two-column FormField alignment when only one field has helper text,
 *   3. the budget dual-thumb RangeSlider.
 *
 * Renders the REAL @inkd/ui primitives (BodyMap, BodyMapThumbnail, FormField,
 * Input, RangeSlider) with the exact markup used in the booking flow's Step 2,
 * so the fixes can be screenshotted in isolation without Supabase. Never linked
 * from product nav. Not for production use.
 */
import { useState } from "react";
import {
  BodyMap,
  BodyMapThumbnail,
  FormField,
  Icon,
  Input,
  RangeSlider,
  placementLabel,
  type PlacementValue,
} from "@inkd/ui/web";

const BUDGET_MIN_USD = 0;
const BUDGET_MAX_USD = 2000;
const BUDGET_STEP_USD = 50;
function formatBudgetUsd(usd: number): string {
  if (usd >= BUDGET_MAX_USD) return `$${BUDGET_MAX_USD.toLocaleString("en-US")}+`;
  return `$${usd.toLocaleString("en-US")}`;
}

export default function Round4BookingPreviewPage() {
  const [placement, setPlacement] = useState<PlacementValue | null>({
    region: "forearm",
    side: "left",
    view: "front",
  });
  const [placementText, setPlacementText] = useState("Inner wrist, wrapping toward the elbow");
  const [size, setSize] = useState('6" tall, palm-sized');
  const [budget, setBudget] = useState<[number, number]>([300, 900]);

  const thumbValue: PlacementValue = placement ?? { region: "forearm", side: "left", view: "front" };

  return (
    <div className="min-h-dvh bg-surface-base text-content-primary">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 py-10">
        <header className="flex flex-col gap-2">
          <span className="w-fit rounded-full border border-border-subtle bg-surface-overlay px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-content-muted">
            Internal · not for production
          </span>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Round 4 — booking fixes
          </h1>
          <p className="text-content-secondary">
            Body map theming, two-column row alignment, and the budget range
            slider — real primitives, offline.
          </p>
        </header>

        {/* Item 1 — body map picker */}
        <section data-testid="bodymap-picker" className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">1 · Placement picker</h2>
          <FormField
            label="Placement"
            description="Tap where the piece goes — front or back, left or right."
          >
            <div className="rounded-xl border border-border-subtle bg-surface-raised/50 p-4">
              <BodyMap value={placement} onChange={setPlacement} />
            </div>
          </FormField>
        </section>

        {/* Item 2 — two-column row alignment */}
        <section data-testid="aligned-rows" className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">2 · Aligned rows</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="Placement details"
              htmlFor="pv-placement"
              description="Optional — the specifics."
            >
              <Input
                id="pv-placement"
                value={placementText}
                onChange={(e) => setPlacementText(e.target.value)}
                leadingIcon={<Icon name="map-pin" size={16} />}
              />
            </FormField>
            <FormField label="Approx. size" htmlFor="pv-size" reserveDescriptionSpace>
              <Input id="pv-size" value={size} onChange={(e) => setSize(e.target.value)} />
            </FormField>
          </div>
        </section>

        {/* Item 3 — budget range slider */}
        <section data-testid="budget-slider" className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">3 · Budget slider</h2>
          <FormField
            label="Budget range"
            description="Optional — helps scope the work. Drag to set a range; the top means “$2,000+”."
          >
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-content-muted">
                  <Icon name="credit-card" size={16} />
                  <span className="text-sm">Estimated budget</span>
                </span>
                <span className="font-mono text-sm tabular-nums text-content-primary">
                  {formatBudgetUsd(budget[0])} – {formatBudgetUsd(budget[1])}
                </span>
              </div>
              <RangeSlider
                value={budget}
                onValueChange={setBudget}
                min={BUDGET_MIN_USD}
                max={BUDGET_MAX_USD}
                step={BUDGET_STEP_USD}
                formatValue={formatBudgetUsd}
              />
            </div>
          </FormField>
        </section>

        {/* Item 1 (cont.) — artist-side placement thumbnail */}
        <section data-testid="placement-thumb" className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">
            1b · Request-detail placement thumb
          </h2>
          <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-content-muted">
              Placement
            </p>
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-border-subtle bg-surface-base p-1.5">
                <BodyMapThumbnail value={thumbValue} size={64} />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-content-primary">
                  {placementLabel(thumbValue, { withView: thumbValue.view })}
                </span>
                <span className="text-sm text-content-muted">{thumbValue.view} view</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
