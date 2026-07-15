import { Icon, cx } from "@inkd/ui/web";
import type { AgentContextEntry } from "@inkd/core";
import { CONTEXT_SOURCE_LABEL } from "./meta";

/**
 * The provenance block — the grounding receipt. A mono list of every piece of
 * the artist's own data the action was built from ("FROM YOUR RATES — 1-hr
 * session $180"). This is the load-bearing trust artifact: agents may never
 * state a price/date they didn't read from a tool, and this shows the reader
 * exactly which tool. An empty list is itself meaningful, so we say so.
 */
export function ProvenanceBlock({
  context,
  className,
}: {
  context: AgentContextEntry[];
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-sm border border-border-subtle bg-surface-plate-ink/60 p-3",
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-content-muted">
        <Icon name="shield" size={11} className="text-content-accent" />
        Data it used
      </div>
      {context.length === 0 ? (
        <p className="font-mono text-[11px] text-content-muted">
          No stored data was consulted for this one.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {context.map((entry, i) => (
            <li
              key={`${entry.source}-${i}`}
              className="flex flex-col gap-0.5 border-l-2 border-border-accent pl-2.5 sm:flex-row sm:items-baseline sm:gap-2"
            >
              <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-content-accent">
                {CONTEXT_SOURCE_LABEL[entry.source]}
              </span>
              <span className="text-[13px] leading-snug text-content-secondary">
                {entry.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
