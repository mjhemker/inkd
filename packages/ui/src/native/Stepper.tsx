import { Text, View } from "react-native";
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
    <View className={cx("flex-row items-start", className)}>
      {steps.map((step, index) => {
        const isCompleted = index < current;
        const isCurrent = index === current;
        const isLast = index === steps.length - 1;

        return (
          <View key={step.label} className={cx("flex-1 items-start", !isLast && "pr-2")}>
            <View className="w-full flex-row items-center">
              <View
                accessibilityRole="text"
                accessibilityLabel={`${step.label}${isCompleted ? ", completed" : isCurrent ? ", current" : ""}`}
                className={cx(
                  "h-6 w-6 items-center justify-center rounded-full border",
                  isCompleted && "border-brand bg-brand",
                  isCurrent && !isCompleted && "border-brand bg-transparent",
                  !isCompleted && !isCurrent && "border-border-subtle bg-transparent",
                )}
              >
                {isCompleted ? (
                  <Icon name="check" size={12} color="#FAFAFA" />
                ) : (
                  <Text
                    className={cx(
                      "font-mono text-[10px]",
                      isCurrent ? "text-content-accent" : "text-content-muted",
                    )}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              {!isLast ? (
                <View
                  className={cx(
                    "h-px flex-1",
                    isCompleted ? "bg-brand" : "bg-border-subtle",
                  )}
                />
              ) : null}
            </View>
            <Text
              className={cx(
                "mt-1.5 text-xs font-sans-medium",
                isCurrent || isCompleted ? "text-content-primary" : "text-content-muted",
              )}
              numberOfLines={1}
            >
              {step.label}
            </Text>
            {step.description ? (
              <Text className="text-[11px] text-content-muted" numberOfLines={1}>
                {step.description}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
