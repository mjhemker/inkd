import { Text, View } from "react-native";
import { Icon, cx } from "@inkd/ui/native";
import type { AgentContextEntry } from "@inkd/core";

import { CONTEXT_SOURCE_LABEL, TIER_META } from "@/lib/aiStaff";
import { useTheme } from "@/providers/theme";

/** Theme-aware AI-staff icon palette. `accent`/`muted` track the active theme
 * so glyphs stay legible in light mode; `emberInk` (ink on the ember plate) and
 * `warn` (status) are theme-independent literals. */
export function useAiColors() {
  const { colors } = useTheme();
  return {
    accent: colors.text.accent,
    muted: colors.text.muted,
    emberInk: "#0A0A0B",
    warn: "#D97706",
  } as const;
}

/** Mono tier stamp — the deterministic policy tier, stamped not styled soft. */
export function TierStamp({ tier, withLabel = true }: { tier: number; withLabel?: boolean }) {
  const meta = TIER_META[tier] ?? { stamp: `TIER ${tier}`, label: "" };
  return (
    <View className="flex-row items-center gap-2">
      <View className="rounded-sm bg-surface-plate-ink px-1.5 py-0.5">
        <Text className="font-mono text-[10px] uppercase tracking-widest text-content-accent">
          {meta.stamp}
        </Text>
      </View>
      {withLabel && meta.label ? (
        <Text className="font-mono text-[10px] uppercase tracking-wider text-content-muted">
          {meta.label}
        </Text>
      ) : null}
    </View>
  );
}

/** The grounding receipt — every piece of the artist's own data used. */
export function ProvenanceBlock({
  context,
  className,
}: {
  context: AgentContextEntry[];
  className?: string;
}) {
  const AI_COLORS = useAiColors();
  return (
    <View className={cx("rounded-sm border border-border-subtle bg-surface-plate-ink/60 p-3", className)}>
      <View className="mb-2 flex-row items-center gap-1.5">
        <Icon name="shield" size={11} color={AI_COLORS.accent} />
        <Text className="font-mono text-[10px] uppercase tracking-widest text-content-muted">
          Data it used
        </Text>
      </View>
      {context.length === 0 ? (
        <Text className="font-mono text-[11px] text-content-muted">
          No stored data was consulted for this one.
        </Text>
      ) : (
        <View className="gap-1.5">
          {context.map((entry, i) => (
            <View key={`${entry.source}-${i}`} className="border-l-2 border-border-accent pl-2.5">
              <Text className="font-mono text-[10px] uppercase tracking-wider text-content-accent">
                {CONTEXT_SOURCE_LABEL[entry.source]}
              </Text>
              <Text className="text-[13px] leading-snug text-content-secondary">{entry.detail}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
