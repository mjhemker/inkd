import { Icon, cx } from "@inkd/ui/web";
import type { AgentRole } from "@inkd/core";
import { STAFF } from "./meta";

/**
 * A mono nameplate presenting an agent role as a member of staff — a small
 * ember-stamped monogram plus the role name in mono. Used on cards and the
 * staff overview header so the AI reads as "your Front Desk", not "the system".
 */
export function StaffNameplate({
  role,
  size = "sm",
  className,
}: {
  role: AgentRole | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const staff = STAFF.find((s) => s.role === role);
  const name = staff?.name ?? "AI staff";
  const icon = staff?.icon ?? "sparkles";
  const dim = size === "md" ? "h-9 w-9" : "h-7 w-7";

  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <span
        className={cx(
          "grid shrink-0 place-items-center rounded-sm bg-surface-ember text-brand-on-ember",
          dim,
        )}
      >
        <Icon name={icon} size={size === "md" ? 18 : 15} />
      </span>
      <span className="flex flex-col leading-tight">
        <span
          className={cx(
            "font-mono uppercase tracking-[0.14em] text-content-primary",
            size === "md" ? "text-[13px]" : "text-[11px]",
          )}
        >
          {name}
        </span>
        {size === "md" && staff?.title && (
          <span className="text-xs text-content-muted">{staff.title}</span>
        )}
      </span>
    </span>
  );
}
