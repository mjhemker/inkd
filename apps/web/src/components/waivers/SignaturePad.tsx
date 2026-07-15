"use client";

/**
 * Drawn e-signature capture on a plain HTML5 canvas — no new dependency.
 * Pointer Events give us mouse + touch + pen in one code path. Exposes the
 * drawing as a base64 PNG data URL (stored directly in
 * `signed_waivers.signature_data` per the column's documented contract:
 * "storage path or base64 of signature").
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cx } from "@inkd/ui/web";

export interface SignaturePadHandle {
  clear: () => void;
  /** Returns null if nothing has been drawn yet. */
  toDataUrl: () => string | null;
}

export interface SignaturePadProps {
  className?: string;
  onChange?: (hasSignature: boolean) => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ className, onChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const hasSignatureRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [isEmpty, setIsEmpty] = useState(true);

    // Size the backing canvas to the element's actual pixel size (accounting
    // for devicePixelRatio) so strokes stay crisp on high-DPI displays.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.25;
      ctx.strokeStyle = "#F4F4F5";
    }, []);

    function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(event.pointerId);
      drawingRef.current = true;
      lastPointRef.current = getPoint(event);
    }

    function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawingRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const point = getPoint(event);
      const last = lastPointRef.current ?? point;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPointRef.current = point;
      if (!hasSignatureRef.current) {
        hasSignatureRef.current = true;
        setIsEmpty(false);
        onChange?.(true);
      }
    }

    function endStroke() {
      drawingRef.current = false;
      lastPointRef.current = null;
    }

    function clear() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasSignatureRef.current = false;
      setIsEmpty(true);
      onChange?.(false);
    }

    useImperativeHandle(ref, () => ({
      clear,
      toDataUrl: () => {
        if (!hasSignatureRef.current) return null;
        return canvasRef.current?.toDataURL("image/png") ?? null;
      },
    }));

    return (
      <div className={cx("flex flex-col gap-2", className)}>
        <div className="relative overflow-hidden rounded-xl border border-border bg-surface-overlay">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Signature drawing area"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
            className="h-40 w-full touch-none"
          />
          {isEmpty && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-sm text-content-muted">
              Sign here
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={clear}
          className="self-start text-xs font-medium text-content-muted underline-offset-2 outline-none transition-colors hover:text-content-primary hover:underline focus-visible:text-content-primary"
        >
          Clear signature
        </button>
      </div>
    );
  },
);
