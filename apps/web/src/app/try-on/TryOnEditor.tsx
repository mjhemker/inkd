"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Eyebrow, Icon, Slider, Toggle, cx } from "@inkd/ui/web";
import {
  DEFAULT_TRYON_TRANSFORM,
  TRYON_DISCLAIMER,
  TRYON_LIMITS,
  TRYON_LOCAL_ONLY_WEB,
  TRYON_TAGLINE,
  TRYON_TITLE,
  clampTransform,
  type TryOnTransform,
} from "@inkd/core";
import {
  createWarpCache,
  drawComposite,
  downloadBlob,
  exportComposite,
  fileToDataUrl,
  loadImage,
  stageSize,
  type LoadedImage,
} from "./composite";

type Status = { tone: "info" | "error" | "ok"; text: string } | null;

export function TryOnEditor({
  initialDesign,
  initialBody = null,
}: {
  initialDesign: string | null;
  /** Dev-harness only: preload a sample body photo. Never set in production. */
  initialBody?: string | null;
}) {
  const router = useRouter();
  const [body, setBody] = useState<LoadedImage | null>(null);
  const [design, setDesign] = useState<LoadedImage | null>(null);
  const [transform, setTransform] = useState<TryOnTransform>(DEFAULT_TRYON_TRANSFORM);
  const [showBefore, setShowBefore] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  // Real history-back when we got here from inside the app (this also lets
  // a "Try it on" launched from a post's overlay land back on that same
  // post — Next's client router cache restores the prior page's component
  // state, including an open post overlay, on a true back navigation). Falls
  // back to /feed when there's nothing to go back to (a shared /try-on link
  // opened directly, or the standalone dev harness).
  const onBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/feed");
    }
  }, [router]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ px: number; py: number; tx: number; ty: number } | null>(null);
  // Persists across redraws so the cylindrical wrap only re-slices when the
  // wrap amount or source design changes, not on every drag/scale/opacity tick.
  const warpCacheRef = useRef(createWarpCache());

  const patch = useCallback(
    (next: Partial<TryOnTransform>) =>
      setTransform((prev) => clampTransform({ ...prev, ...next })),
    [],
  );

  // Load a deep-linked design once on mount.
  useEffect(() => {
    if (!initialDesign) return;
    let alive = true;
    loadImage(initialDesign)
      .then((img) => {
        if (!alive) return;
        setDesign(img);
        if (img.crossOriginBlocked) {
          setStatus({
            tone: "info",
            text: "Design loaded from a link — to export you may need to upload the file directly.",
          });
        }
      })
      .catch(() => {
        if (alive) setStatus({ tone: "error", text: "Couldn't load that design. Upload it instead." });
      });
    return () => {
      alive = false;
    };
  }, [initialDesign]);

  // Dev-harness only: preload a sample body photo.
  useEffect(() => {
    if (!initialBody) return;
    let alive = true;
    loadImage(initialBody)
      .then((img) => {
        if (alive) setBody(img);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [initialBody]);

  const size = useMemo(() => (body ? stageSize(body) : null), [body]);

  // Redraw whenever inputs change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !body || !size) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawComposite(ctx, size.width, size.height, body, design, transform, {
      showDesign: !showBefore,
      warpCache: warpCacheRef.current,
    });
  }, [body, design, transform, showBefore, size]);

  const onPickBody = useCallback(async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      const img = await loadImage(url);
      setBody(img);
      setStatus(null);
    } catch {
      setStatus({ tone: "error", text: "Couldn't read that photo. Try a JPG or PNG." });
    }
  }, []);

  const onPickDesign = useCallback(async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      const img = await loadImage(url);
      setDesign(img);
      setTransform(DEFAULT_TRYON_TRANSFORM);
      setStatus(null);
    } catch {
      setStatus({ tone: "error", text: "Couldn't read that design. Try a transparent PNG." });
    }
  }, []);

  // --- pointer drag on the stage --------------------------------------------
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!design || showBefore) return;
      const rect = e.currentTarget.getBoundingClientRect();
      dragRef.current = {
        px: (e.clientX - rect.left) / rect.width,
        py: (e.clientY - rect.top) / rect.height,
        tx: transform.x,
        ty: transform.y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [design, showBefore, transform.x, transform.y],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const d = dragRef.current;
      if (!d) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      patch({ x: d.tx + (px - d.px), y: d.ty + (py - d.py) });
    },
    [patch],
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      if (!design || showBefore) return;
      const factor = e.deltaY < 0 ? 1.06 : 0.94;
      setTransform((prev) => clampTransform({ ...prev, scale: prev.scale * factor }));
    },
    [design, showBefore],
  );

  const onExport = useCallback(async () => {
    if (!body) return;
    setBusy(true);
    try {
      const blob = await exportComposite(body, design, transform);
      downloadBlob(blob, "inkd-fit-check.png");
      setStatus({ tone: "ok", text: "Saved — it's a placement preview, not a prediction." });
    } catch (err) {
      const tainted = err instanceof DOMException && err.name === "SecurityError";
      setStatus({
        tone: "error",
        text: tainted
          ? "This design is hosted without cross-origin access — upload the file directly to export."
          : "Export failed. Try again.",
      });
    } finally {
      setBusy(false);
    }
  }, [body, design, transform]);

  const reset = useCallback(() => setTransform(DEFAULT_TRYON_TRANSFORM), []);

  return (
    <div className="min-h-dvh bg-surface-base text-content-primary">
      <Header onBack={onBack} />

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1.3fr_1fr] lg:px-6 lg:py-8">
        {/* Stage */}
        <section className="flex flex-col gap-3">
          <div className="relative overflow-hidden rounded-sm border border-border bg-surface-raised">
            {body && size ? (
              <canvas
                ref={canvasRef}
                width={size.width}
                height={size.height}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onWheel={onWheel}
                className={cx(
                  "block h-auto w-full touch-none select-none",
                  design && !showBefore ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                )}
                aria-label="Fit check preview"
              />
            ) : (
              <UploadStage onPick={onPickBody} />
            )}

            {body && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-200">
                  Fit check · not a prediction
                </span>
                {showBefore && (
                  <Badge variant="neutral" size="sm">
                    Before
                  </Badge>
                )}
              </div>
            )}
          </div>

          {body && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBefore((v) => !v)}
                disabled={!design}
                leadingIcon={<Icon name="image" size={15} />}
              >
                {showBefore ? "After" : "Before"}
              </Button>
              <label className="cursor-pointer">
                <span className="sr-only">Change photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void onPickBody(e.target.files?.[0])}
                />
                <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-overlay px-3 text-sm font-semibold text-content-secondary transition-colors hover:border-border-strong hover:text-content-primary">
                  <Icon name="user" size={15} /> Change photo
                </span>
              </label>
              <Button variant="ghost" size="sm" onClick={reset} disabled={!design}>
                Reset placement
              </Button>
            </div>
          )}
        </section>

        {/* Controls */}
        <section className="flex flex-col gap-5">
          <DesignSlot design={design} onPick={onPickDesign} />

          <div
            className={cx(
              "flex flex-col gap-5 rounded-sm border border-border-subtle bg-surface-raised p-4",
              (!body || !design) && "pointer-events-none opacity-45",
            )}
            aria-disabled={!body || !design}
          >
            <Eyebrow>Placement</Eyebrow>
            <Slider
              label="Size"
              value={transform.scale}
              onValueChange={(v) => patch({ scale: v })}
              min={TRYON_LIMITS.scaleMin}
              max={TRYON_LIMITS.scaleMax}
              step={0.01}
            />
            <Slider
              label="Rotate"
              value={transform.rotation}
              onValueChange={(v) => patch({ rotation: v })}
              min={TRYON_LIMITS.rotationMin}
              max={TRYON_LIMITS.rotationMax}
              step={1}
            />
            <Slider
              label="Wrap (limb curve)"
              value={transform.wrap}
              onValueChange={(v) => patch({ wrap: v })}
              min={TRYON_LIMITS.wrapMin}
              max={TRYON_LIMITS.wrapMax}
              step={1}
            />
            <Slider
              label="Opacity"
              value={transform.opacity}
              onValueChange={(v) => patch({ opacity: v })}
              min={TRYON_LIMITS.opacityMin}
              max={TRYON_LIMITS.opacityMax}
              step={0.01}
            />
            <Toggle
              checked={transform.inkBlend}
              onCheckedChange={(v) => patch({ inkBlend: v })}
              label="Ink blend"
            />
            <p className="-mt-2 text-xs leading-relaxed text-content-muted">
              Ink blend sinks the design into the skin (multiply + a touch of
              desaturation). On very dark skin, turn it off and lean on opacity.
            </p>
          </div>

          {status && (
            <p
              className={cx(
                "rounded-sm border px-3 py-2 text-sm",
                status.tone === "error" && "border-danger-500/40 bg-danger-500/10 text-danger-500",
                status.tone === "ok" && "border-brand/40 bg-brand/10 text-content-accent",
                status.tone === "info" && "border-border bg-surface-overlay text-content-secondary",
              )}
            >
              {status.text}
            </p>
          )}

          {/* Honesty rail — always visible before export */}
          <div className="flex flex-col gap-3 rounded-sm border border-border-subtle bg-surface-overlay p-4">
            <div className="flex items-start gap-2.5">
              <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-content-muted" />
              <p className="text-xs leading-relaxed text-content-secondary">{TRYON_DISCLAIMER}</p>
            </div>
            <Button
              onClick={() => void onExport()}
              disabled={!body || busy}
              loading={busy}
              leadingIcon={<Icon name="arrow-right" size={16} />}
            >
              Download fit check
            </Button>
            <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted">
              Stamped “placement preview, not a prediction”
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="border-b border-border-subtle">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 lg:px-6">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1.5 inline-flex w-fit items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-semibold text-content-secondary transition-colors hover:text-content-primary"
        >
          <Icon name="chevron-left" size={18} />
          Back
        </button>
        <Eyebrow>INKD · fit check</Eyebrow>
        <h1 className="font-display text-3xl font-extrabold tracking-tight lg:text-4xl">
          {TRYON_TITLE}
        </h1>
        <p className="max-w-2xl font-hand text-2xl leading-tight text-content-ember">
          {TRYON_TAGLINE}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-content-muted">
          <Icon name="shield" size={13} /> {TRYON_LOCAL_ONLY_WEB}
        </p>
      </div>
    </header>
  );
}

function UploadStage({ onPick }: { onPick: (file: File | undefined) => void }) {
  return (
    <label className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-4 p-6 text-center">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <span className="grid h-14 w-14 place-items-center rounded-full border border-border bg-surface-overlay text-content-secondary">
        <Icon name="image" size={24} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-display text-lg font-bold">Add a body photo</span>
        <span className="max-w-xs text-sm text-content-secondary">
          Pick a clear, flat shot of the spot — an arm, a calf, a forearm.
        </span>
        <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted">
          Stays on your device
        </span>
      </span>
    </label>
  );
}

function DesignSlot({
  design,
  onPick,
}: {
  design: LoadedImage | null;
  onPick: (file: File | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-sm border border-border-subtle bg-surface-raised p-3">
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-sm border border-border-subtle bg-surface-overlay">
        {design ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={design.el.src} alt="Chosen design" className="h-full w-full object-contain" />
        ) : (
          <Icon name="sparkles" size={20} className="text-content-muted" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-display text-sm font-bold">
          {design ? "Design ready" : "Add a design"}
        </span>
        <span className="truncate text-xs text-content-muted">
          Upload a PNG or JPG — transparent PNGs blend best.
        </span>
      </div>
      <label className="cursor-pointer">
        <span className="sr-only">Choose design</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand bg-brand px-3 text-sm font-semibold text-brand-on transition-colors hover:bg-brand-hover">
          <Icon name="plus" size={15} /> {design ? "Change" : "Choose"}
        </span>
      </label>
    </div>
  );
}
