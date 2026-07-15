"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cx } from "@inkd/ui/web";
import { ThreadListPane } from "./ThreadListPane";

/**
 * Two-pane `/messages` frame: threads on the left, active conversation on the
 * right, at md+. Below that, the two panes stack into a single screen that
 * swaps based on the route — the list at `/messages`, the chat at
 * `/messages/[threadId]` (and the in-flight `/messages/new` resolver).
 */
export function MessagesShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDetail = pathname !== "/messages";

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised/20 md:h-[calc(100dvh-7.5rem)]">
      <div
        className={cx(
          "w-full shrink-0 overflow-hidden border-border-subtle md:block md:w-[340px] md:border-r lg:w-[380px]",
          isDetail ? "hidden" : "block",
        )}
      >
        <ThreadListPane />
      </div>
      <div
        className={cx(
          "min-w-0 flex-1 overflow-hidden",
          isDetail ? "flex" : "hidden md:flex",
        )}
      >
        {children}
      </div>
    </div>
  );
}
