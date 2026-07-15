"use client";

import { cloneElement, isValidElement, useId, type ReactNode } from "react";
import { cx } from "../cx";

export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

interface FieldElementProps {
  id?: string;
  [key: string]: unknown;
}

export function FormField({
  label,
  htmlFor,
  description,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = htmlFor ?? generatedId;

  const wiredChildren =
    isValidElement<FieldElementProps>(children) && !children.props.id
      ? cloneElement(children, { id: fieldId })
      : children;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={fieldId}
          className="font-sans text-sm font-medium text-content-primary"
        >
          {label}
          {required && <span className="ml-0.5 text-content-accent">*</span>}
        </label>
      )}
      {description && (
        <p className="text-sm text-content-muted">{description}</p>
      )}
      {wiredChildren}
      {error && (
        <p role="alert" className="text-sm text-danger-500">
          {error}
        </p>
      )}
    </div>
  );
}
