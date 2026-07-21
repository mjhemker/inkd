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
  /**
   * The screen's single hero — when THIS card is the thing to act on (e.g. the
   * needs-review booking card). Adds the hard offset shadow (ink/ember) behind
   * a flat surface card. `className` applies to the outer wrapper (layout).
   * Screens opt in — never self-declared.
   */
  hero?: boolean;
  children?: ReactNode;
  className?: string;
}

export const Card = forwardRef<View, CardProps>(function Card(
  { variant = "default", padding = "md", hero = false, onPress, children, className, ...props },
  ref,
) {
  // Hero: the one offset shadow per screen, painted as an absolutely-positioned
  // backing View shifted 5px down-right BEHIND a flat surface card (RN can't
  // render a hard 0-blur colored offset via elevation on Android). On press the
  // face translates 3px into the backing. See docs/zine-hierarchy.md.
  if (hero) {
    const face = cx(
      "w-full rounded-sm border border-hero-border bg-surface-raised",
      paddingClass[padding],
    );
    return (
      <View className={cx("relative", className)}>
        <View
          pointerEvents="none"
          className="absolute inset-0 rounded-sm bg-hero-shadow"
          style={{ transform: [{ translateX: 5 }, { translateY: 5 }] }}
        />
        {onPress ? (
          <Pressable
            ref={ref}
            accessibilityRole="button"
            onPress={onPress}
            className={cx(face, "active:translate-x-[3px] active:translate-y-[3px]")}
            {...props}
          >
            {children}
          </Pressable>
        ) : (
          <View ref={ref} className={face} {...props}>
            {children}
          </View>
        )}
      </View>
    );
  }

  const classes = cx(
    // Placard discipline: near-square hard edge.
    "rounded-sm",
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

export interface CardPlacardProps extends Omit<ViewProps, "children"> {
  /** Right-aligned secondary mark, e.g. a stamped price. */
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Museum-placard header strip: mono, uppercase, on a solid ink strip. */
export function CardPlacard({ meta, children, className, ...props }: CardPlacardProps) {
  return (
    <View
      className={cx(
        "flex-row items-center justify-between gap-3 border-b border-border-subtle bg-surface-overlay px-4 py-2",
        className,
      )}
      {...props}
    >
      <Text className="font-mono text-[11px] uppercase tracking-widest text-content-muted">
        {children}
      </Text>
      {meta != null ? (
        <Text className="font-mono text-[11px] uppercase tracking-widest text-content-secondary">
          {meta}
        </Text>
      ) : null}
    </View>
  );
}
