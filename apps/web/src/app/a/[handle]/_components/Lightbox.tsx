"use client";

import { useEffect } from "react";
import { Icon } from "@inkd/ui/web";

export interface LightboxImage {
  src: string;
  title?: string | null;
  caption?: string | null;
}

/** Full-bleed image viewer for the portfolio grid — arrow-key + swipe-free
 * (click zone) navigation, Escape to close. */
export function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: LightboxImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const image = images[index];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onIndexChange((index + 1) % images.length);
      if (event.key === "ArrowLeft") onIndexChange((index - 1 + images.length) % images.length);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [index, images.length, onClose, onIndexChange]);

  if (!image) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.title ?? "Portfolio image"}
      className="fixed inset-0 z-[90] flex flex-col bg-black/95 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex items-center justify-between px-5 py-4">
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-content-muted">
          {index + 1} / {images.length}
        </span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-content-primary outline-none transition-colors hover:bg-white/20"
        >
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 pb-4">
        {images.length > 1 && (
          <NavButton
            direction="left"
            onClick={() => onIndexChange((index - 1 + images.length) % images.length)}
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={image.title ?? ""}
          className="max-h-[78vh] max-w-full rounded-lg object-contain shadow-lg"
        />
        {images.length > 1 && (
          <NavButton
            direction="right"
            onClick={() => onIndexChange((index + 1) % images.length)}
          />
        )}
      </div>

      {(image.title || image.caption) && (
        <div className="px-5 pb-6 text-center">
          {image.title && (
            <p className="font-display text-lg font-semibold text-content-primary">{image.title}</p>
          )}
          {image.caption && <p className="text-sm text-content-muted">{image.caption}</p>}
        </div>
      )}
    </div>
  );
}

function NavButton({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={direction === "left" ? "Previous image" : "Next image"}
      onClick={onClick}
      className={`absolute ${direction === "left" ? "left-2 sm:left-6" : "right-2 sm:right-6"} inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-content-primary outline-none transition-colors hover:bg-white/20`}
    >
      <Icon name={direction === "left" ? "chevron-left" : "chevron-right"} size={20} />
    </button>
  );
}
