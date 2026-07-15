import { forwardRef } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { cx } from "../cx";

export interface TextAreaProps extends TextInputProps {
  invalid?: boolean;
  className?: string;
}

export const TextArea = forwardRef<TextInput, TextAreaProps>(function TextArea(
  { invalid = false, className, numberOfLines = 4, editable = true, ...props },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      multiline
      numberOfLines={numberOfLines}
      textAlignVertical="top"
      editable={editable}
      placeholderTextColor="#71717A"
      className={cx(
        "rounded-lg border bg-surface-raised px-3 py-2 font-sans text-sm text-content-primary",
        invalid ? "border-danger-500" : "border-border",
        !editable && "opacity-50",
        className,
      )}
      {...props}
    />
  );
});
