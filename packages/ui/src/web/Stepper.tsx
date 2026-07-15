import { cx } from "../cx";
import { Icon } from "./Icon";

export interface StepperStep {
  label: string;
  description?: string;
}

export interface StepperProps {
  steps: StepperStep[];
  current: number;
  className?: string;
}

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cx("flex w-full items-start", className)}>
      {steps.map((step, index) => {
        const isComplete = index < current;
        const isCurrent = index === current;
        const isLast = index === steps.length - 1;
        return (
          <li
            key={step.label}
            className={cx("flex flex-1 flex-col items-start", !isLast && "pr-2")}
          >
            <div className="flex w-full items-center">
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={cx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-colors duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)]",
                  isComplete &&
                    "border-border-accent bg-brand text-brand-on",
                  isCurrent &&
                    "border-border-accent bg-transparent text-content-accent",
                  !isComplete && !isCurrent &&
                    "border-border text-content-muted",
                )}
              >
                {isComplete ? (
                  <Icon name="check" size={14} strokeWidth={2.25} />
                ) : (
                  index + 1
                )}
              </span>
              {!isLast && (
                <span
                  className={cx(
                    "ml-2 h-px flex-1",
                    isComplete ? "bg-border-accent" : "bg-border-subtle",
                  )}
                />
              )}
            </div>
            <div className="mt-2 flex flex-col gap-0.5">
              <span
                className={cx(
                  "text-sm font-medium",
                  isCurrent || isComplete
                    ? "text-content-primary"
                    : "text-content-muted",
                )}
              >
                {step.label}
              </span>
              {step.description && (
                <span className="text-xs text-content-muted">
                  {step.description}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
