import { forwardRef, type ReactNode } from "react";
import { Pressable, Text, View, type PressableProps, type ViewProps } from "react-native";
import { cx } from "../cx";

export type CardVariant = "default" | "raised" | "outlined" | "interactive";
export type CardPadding = "none" | "sm" | "md" | "lg";

const variantClass: Record<CardVariant, string> = {
  default: "bg-surface-raised border border-border-subtle",
  raised: "bg-surface-overlay border border-border-subtle",
  outlined: "bg-transparent border border-border",
  interactive:
    "bg-surface-raised border border-border-subtle active:bg-surface-overlay",
};

const paddingClass: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export interface CardProps extends Omit<ViewProps, "children">, Pick<PressableProps, "onPress"> {
  variant?: CardVariant;
  padding?: CardPadding;
  children?: ReactNode;
  className?: string;
}

export const Card = forwardRef<View, CardProps>(function Card(
  { variant = "default", padding = "md", onPress, children, className, ...props },
  ref,
) {
  const classes = cx(
    "rounded-xl",
    variantClass[variant],
    paddingClass[padding],
    className,
  );

  if (variant === "interactive" || onPress) {
    return (
      <Pressable
        ref={ref}
        accessibilityRole="button"
        onPress={onPress}
        className={classes}
        {...props}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View ref={ref} className={classes} {...props}>
      {children}
    </View>
  );
});

export interface CardSectionProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
  className?: string;
}

export function CardHeader({ children, className, ...props }: CardSectionProps) {
  return (
    <View className={cx("mb-3 gap-1", className)} {...props}>
      {children}
    </View>
  );
}

export interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <Text className={cx("font-display text-lg text-content-primary", className)}>
      {children}
    </Text>
  );
}

export interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className }: CardDescriptionProps) {
  return (
    <Text className={cx("text-sm text-content-muted", className)}>{children}</Text>
  );
}

export function CardContent({ children, className, ...props }: CardSectionProps) {
  return (
    <View className={cx(className)} {...props}>
      {children}
    </View>
  );
}

export function CardFooter({ children, className, ...props }: CardSectionProps) {
  return (
    <View
      className={cx("mt-3 flex-row items-center justify-between", className)}
      {...props}
    >
      {children}
    </View>
  );
}
