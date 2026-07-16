"use client";

/**
 * Appearance control — the Dark / Light / System segmented picker wired to the
 * web ThemeProvider. Used in Settings and the /dev/ui gallery. The choice
 * persists to localStorage; the app defaults to Dark.
 */
import { Icon, cx, type IconName } from "@inkd/ui/web";
import {
  useTheme,
  type ThemePreference,
} from "@/components/theme-provider";

const OPTIONS: { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "system", label: "System", icon: "monitor" },
];

export function AppearanceControl({ className }: { className?: string }) {
  const { preference, resolved, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={cx(
        "inline-grid grid-cols-3 gap-1 rounded-lg border border-border-subtle bg-surface-raised p-1",
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const active = preference === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(opt.value)}
            className={cx(
              "flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised",
              active
                ? "bg-surface-plate text-brand-on"
                : "text-content-secondary hover:bg-surface-overlay hover:text-content-primary",
            )}
          >
            <Icon name={opt.icon} size={16} />
            {opt.label}
          </button>
        );
      })}
      <span className="sr-only" aria-live="polite">
        {`Theme: ${resolved}`}
      </span>
    </div>
  );
}
