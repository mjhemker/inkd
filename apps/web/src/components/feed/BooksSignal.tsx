import { cx } from "@inkd/ui/web";

/**
 * Books open/closed signal (artist_profiles.accepts_new_clients) — a quiet mono
 * micro-label with a filled/hollow dot, the kind of status you'd read off a
 * studio door. Open reads in violet; closed recedes to muted.
 */
export function BooksSignal({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]",
        open ? "text-content-accent" : "text-content-muted",
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          "h-1.5 w-1.5 rounded-full",
          open ? "bg-brand" : "border border-content-muted",
        )}
      />
      {open ? "Books open" : "Books closed"}
    </span>
  );
}
