import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { cx } from "../cx";

export interface FormFieldProps {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  description,
  error,
  required = false,
  children,
  className,
}: FormFieldProps) {
  return (
    <View className={cx("gap-1.5", className)}>
      {label ? (
        <Text className="font-sans-medium text-sm text-content-primary">
          {label}
          {required ? <Text className="text-danger-500"> *</Text> : null}
        </Text>
      ) : null}
      {description ? (
        <Text className="text-sm text-content-muted">{description}</Text>
      ) : null}
      {children}
      {error ? <Text className="text-sm text-danger-500">{error}</Text> : null}
    </View>
  );
}
