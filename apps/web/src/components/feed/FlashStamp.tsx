import { cx } from "@inkd/ui/web";

/**
 * The ember FLASH stamp — a small solid ember plate stamped on flash artwork.
 * Ember is "wall warmth": reserved for flash/price heat, never a CTA. Dark ink
 * on the solid ember plate (brand.onEmber).
 */
export function FlashStamp({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-sm bg-surface-ember px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-on-ember shadow-plate",
        className,
      )}
    >
      Flash
    </span>
  );
}
