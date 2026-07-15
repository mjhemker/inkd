import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cx } from "../cx";
import { fieldBase } from "./Input";

export interface TextAreaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea({ invalid = false, rows = 4, className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={cx(
          fieldBase,
          "px-3 py-2 text-sm leading-relaxed",
          invalid ? "border-danger-500" : "border-border",
          className,
        )}
        {...props}
      />
    );
  },
);
