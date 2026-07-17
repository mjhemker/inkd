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
  /**
   * When true and no `description` is given, reserve one line of helper-text
   * height so the control sits on the same baseline as a sibling field that
   * DOES have a description. Used to keep two-column form rows aligned when only
   * one field carries helper text.
   */
  reserveDescriptionSpace?: boolean;
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
  reserveDescriptionSpace = false,
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
      {description ? (
        <p className="text-sm text-content-muted">{description}</p>
      ) : reserveDescriptionSpace ? (
        <p aria-hidden className="select-none text-sm text-content-muted">
          &nbsp;
        </p>
      ) : null}
      {wiredChildren}
      {error && (
        <p role="alert" className="text-sm text-danger-500">
          {error}
        </p>
      )}
    </div>
  );
}
