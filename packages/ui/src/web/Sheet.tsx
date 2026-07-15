"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";

export type SheetSide = "bottom" | "right";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  side?: SheetSide;
}

const sideStyles: Record<SheetSide, string> = {
  bottom:
    "inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-2xl border-t",
  right:
    "inset-y-0 right-0 h-full w-full max-w-md border-l",
};

export function Sheet({ open, onClose, title, children, side = "bottom" }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "inkd-sheet-title" : undefined}
        tabIndex={-1}
        className={cx(
          "absolute flex flex-col gap-4 overflow-y-auto border-border-subtle bg-surface-raised p-6 shadow-lg outline-none",
          sideStyles[side],
        )}
      >
        <div className="flex items-start justify-between gap-4">
          {title && (
            <h2
              id="inkd-sheet-title"
              className="font-sans text-lg font-semibold text-content-primary"
            >
              {title}
            </h2>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-content-muted outline-none transition-colors duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)] hover:bg-surface-overlay hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        {children && <div className="text-sm text-content-secondary">{children}</div>}
      </div>
    </div>
  );
}
