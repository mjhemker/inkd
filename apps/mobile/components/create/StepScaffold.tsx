import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Icon, ProgressBar } from "@inkd/ui/native";

import { useTheme } from "@/providers/theme";

/**
 * Shared chrome for the progressive, full-screen Add flows (Add to portfolio /
 * New post). One prompt per screen: a local header (back chevron + step count +
 * close), a progress bar, the step title + prompt, the step body, and a sticky
 * primary action.
 *
 * The back control is a LOCAL header button (an Icon in a Pressable) — the
 * shared BackButton component is owned by another branch and must not be
 * touched; this uses only existing primitives.
 */
export function StepScaffold({
  title,
  prompt,
  stepIndex,
  stepCount,
  onBack,
  onClose,
  onNext,
  nextLabel = "Continue",
  canNext = true,
  loading = false,
  children,
}: {
  title: string;
  prompt: string;
  stepIndex: number;
  stepCount: number;
  onBack: () => void;
  onClose: () => void;
  onNext: () => void;
  nextLabel?: string;
  canNext?: boolean;
  loading?: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      {/* Header: back · step count · close */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={onBack}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-raised"
        >
          <Icon name="chevron-left" size={24} color={colors.text.primary} />
        </Pressable>
        <Text className="font-mono text-xs text-content-muted">
          STEP {stepIndex + 1} OF {stepCount}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          onPress={onClose}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-raised"
        >
          <Icon name="x" size={22} color={colors.text.secondary} />
        </Pressable>
      </View>

      <View className="px-6 pb-4">
        <ProgressBar value={stepIndex + 1} max={stepCount} size="sm" />
      </View>

      {/* Step body */}
      <ScrollView className="flex-1" contentContainerClassName="gap-5 px-6 pb-8">
        <View className="gap-1.5">
          <Text className="font-display text-2xl text-content-primary">{title}</Text>
          <Text className="text-sm text-content-secondary">{prompt}</Text>
        </View>
        {children}
      </ScrollView>

      {/* Sticky primary action */}
      <View className="border-t border-border-subtle px-6 pb-2 pt-3">
        <Button onPress={onNext} disabled={!canNext} loading={loading} className="w-full">
          {nextLabel}
        </Button>
      </View>
    </SafeAreaView>
  );
}
