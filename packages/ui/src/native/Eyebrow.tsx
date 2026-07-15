import { Text, type TextProps } from "react-native";
import { cx } from "../cx";

export interface EyebrowProps extends Omit<TextProps, "children"> {
  children: string;
  className?: string;
}

/** Mono, uppercase, tracked label used above section/card titles. */
export function Eyebrow({ children, className, ...props }: EyebrowProps) {
  return (
    <Text
      className={cx(
        "font-mono text-xs uppercase tracking-widest text-content-muted",
        className,
      )}
      {...props}
    >
      {children}
    </Text>
  );
}
