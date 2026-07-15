import { forwardRef, type ReactNode } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { cx } from "../cx";

export type InputSize = "sm" | "md" | "lg";

const sizeHeight: Record<InputSize, string> = {
  sm: "h-9",
  md: "h-11",
  lg: "h-12",
};

const sizeText: Record<InputSize, string> = {
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base",
};

export interface InputProps extends TextInputProps {
  size?: InputSize;
  invalid?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  className?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    size = "md",
    invalid = false,
    leadingIcon,
    trailingIcon,
    className,
    editable = true,
    ...props
  },
  ref,
) {
  return (
    <View
      className={cx(
        "flex-row items-center gap-2 rounded-lg border bg-surface-raised px-3",
        invalid ? "border-danger-500" : "border-border",
        !editable && "opacity-50",
        sizeHeight[size],
        className,
      )}
    >
      {leadingIcon}
      <TextInput
        ref={ref}
        editable={editable}
        placeholderTextColor="#71717A"
        className={cx("flex-1 font-sans text-content-primary", sizeText[size])}
        {...props}
      />
      {trailingIcon}
    </View>
  );
});
