"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "../cx";

export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  items: TabItem[];
  className?: string;
}

export function Tabs({ value, onValueChange, items, className }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (items.length === 0) return;
    const currentIndex = items.findIndex((item) => item.value === value);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % items.length;
    else if (event.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = items.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    const next = items[nextIndex];
    if (!next) return;
    onValueChange(next.value);
    const button = listRef.current?.querySelectorAll<HTMLButtonElement>(
      "[role='tab']",
    )[nextIndex];
    button?.focus();
  }

  return (
    // Segmented control on a flat raised track (placard language). Zine rule:
    // the active tab INVERTS to solid ink — solid black w/ white text in
    // daylight, solid off-white w/ black text at night (surface-inverse /
    // content-inverse) — NOT a violet-tinted active tab. Inactive tabs stay
    // flat hairline. Red count pills passed into a tab's icon slot are
    // preserved. Hard edges, generous hit area, consistent app-wide.
    <div
      ref={listRef}
      role="tablist"
      className={cx(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border-subtle bg-surface-raised p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`tabpanel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            className={cx(
              "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-sm px-3.5 text-sm font-semibold outline-none transition-[background-color,color] duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised",
              selected
                ? "bg-surface-inverse text-content-inverse"
                : "text-content-secondary hover:bg-surface-overlay/60 hover:text-content-primary",
            )}
          >
            {item.icon && <span className="inline-flex">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
