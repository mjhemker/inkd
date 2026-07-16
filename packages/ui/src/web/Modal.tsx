"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";

export type ModalSize = "sm" | "md" | "lg";

const sizes: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Keep the latest onClose in a ref so the open/focus effect below does NOT
  // depend on it. Callers almost always pass an inline `() => setOpen(false)`,
  // which is a fresh function every render — if the effect depended on it, it
  // would re-run on every parent render (i.e. every keystroke in a field inside
  // the modal) and `panelRef.current?.focus()` would steal focus back from the
  // input. Ref-forwarding the handler lets the effect key purely on `open`.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "inkd-modal-title" : undefined}
        aria-describedby={description ? "inkd-modal-description" : undefined}
        tabIndex={-1}
        className={cx(
          "flex w-full flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-raised p-6 shadow-lg outline-none",
          sizes[size],
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            {title && (
              <h2
                id="inkd-modal-title"
                className="font-sans text-lg font-semibold text-content-primary"
              >
                {title}
              </h2>
            )}
            {description && (
              <p id="inkd-modal-description" className="text-sm text-content-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-content-muted outline-none transition-colors duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)] hover:bg-surface-overlay hover:text-content-primary focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        {children && <div className="text-sm text-content-secondary">{children}</div>}
        {footer && <div className="flex items-center justify-end gap-2 pt-2">{footer}</div>}
      </div>
    </div>
  );
}
