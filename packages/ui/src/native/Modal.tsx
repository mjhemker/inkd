import type { ReactNode } from "react";
import { Modal as RNModal, Pressable, Text, View } from "react-native";
import { cx } from "../cx";
import { Icon } from "./Icon";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Centered dialog built on RN <Modal>, transparent + fade. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  return (
    <RNModal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close"
        accessibilityRole="button"
        onPress={onClose}
        className="flex-1 items-center justify-center bg-black/60 px-6"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={cx(
            "w-full max-w-md gap-3 rounded-2xl border border-border-subtle bg-surface-raised p-5",
            className,
          )}
        >
          {title || description ? (
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                {title ? (
                  <Text className="font-display text-lg text-content-primary">
                    {title}
                  </Text>
                ) : null}
                {description ? (
                  <Text className="text-sm text-content-muted">{description}</Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                onPress={onClose}
              >
                <Icon name="x" size={20} color="#A1A1AA" />
              </Pressable>
            </View>
          ) : null}
          {children}
          {footer ? <View className="mt-2 flex-row justify-end gap-2">{footer}</View> : null}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
