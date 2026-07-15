import type { ReactNode } from "react";
import { Modal as RNModal, Pressable, Text, View } from "react-native";
import { cx } from "../cx";
import { Icon } from "./Icon";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  className?: string;
}

/** Bottom sheet built on RN <Modal>, transparent + slide. */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  return (
    <RNModal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel="Close"
        accessibilityRole="button"
        onPress={onClose}
        className="flex-1 justify-end bg-black/60"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={cx(
            "rounded-t-2xl border-t border-border-subtle bg-surface-raised px-4 pb-8 pt-3",
            className,
          )}
        >
          <View className="mb-3 items-center">
            <View className="h-1 w-10 rounded-full bg-border-strong" />
          </View>
          {title ? (
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-display text-lg text-content-primary">
                {title}
              </Text>
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
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
