/**
 * Native `<Select>`, `<DateField>` and `<TimeField>` from @inkd/ui/native are
 * trigger-only Pressables (documented "native divergence" — no portal-based
 * popover / no native date-time-picker dependency is wired into this app).
 * These wrapper components supply the missing interaction: a bottom `<Sheet>`
 * with either a tappable option list (Select) or a manual text entry (Date /
 * Time), so every editor below can use one consistent picker pattern without
 * pulling in a new native dependency.
 */
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Button,
  DateField,
  Icon,
  Input,
  Select,
  Sheet,
  TimeField,
  cx,
  type SelectSize,
} from "@inkd/ui/native";
import { useTheme } from "@/providers/theme";

export interface PickerOption {
  label: string;
  value: string;
}

interface OptionListProps {
  options: PickerOption[];
  value?: string;
  onSelect: (value: string) => void;
}

function OptionList({ options, value, onSelect }: OptionListProps) {
  const { colors } = useTheme();
  return (
    <View className="gap-0.5 pb-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            onPress={() => onSelect(o.value)}
            className="min-h-11 flex-row items-center justify-between rounded-lg px-2 py-2.5 active:bg-surface-overlay"
          >
            <Text
              className={cx(
                "text-sm",
                active ? "font-sans-medium text-content-accent" : "text-content-primary",
              )}
            >
              {o.label}
            </Text>
            {active ? <Icon name="check" size={16} color={colors.text.accent} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export interface PickerSelectProps {
  value?: string;
  options: PickerOption[];
  placeholder?: string;
  title?: string;
  size?: SelectSize;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  onValueChange: (value: string) => void;
}

/** A native Select trigger backed by a bottom-sheet option list. */
export function PickerSelect({
  value,
  options,
  placeholder,
  title,
  size,
  disabled,
  invalid,
  className,
  onValueChange,
}: PickerSelectProps) {
  const [open, setOpen] = useState(false);
  const label = options.find((o) => o.value === value)?.label;

  return (
    <>
      <Select
        value={label}
        placeholder={placeholder}
        size={size}
        disabled={disabled}
        invalid={invalid}
        className={className}
        onPress={() => setOpen(true)}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title={title ?? "Choose one"}>
        <OptionList
          options={options}
          value={value}
          onSelect={(v) => {
            onValueChange(v);
            setOpen(false);
          }}
        />
      </Sheet>
    </>
  );
}

export interface PickerDateFieldProps {
  value?: string;
  placeholder?: string;
  size?: "sm" | "md";
  className?: string;
  onValueChange: (value: string) => void;
}

/** A native DateField trigger backed by a manual "YYYY-MM-DD" entry sheet. */
export function PickerDateField({
  value,
  placeholder,
  className,
  onValueChange,
}: PickerDateFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    if (open) setDraft(value ?? "");
  }, [open, value]);

  return (
    <>
      <DateField
        value={value}
        placeholder={placeholder}
        className={className}
        onPress={() => setOpen(true)}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title="Enter date">
        <View className="gap-3 pb-2">
          <Input
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            value={draft}
            onChangeText={setDraft}
          />
          <Button
            onPress={() => {
              if (draft.trim()) onValueChange(draft.trim());
              setOpen(false);
            }}
          >
            Done
          </Button>
        </View>
      </Sheet>
    </>
  );
}

export interface PickerTimeFieldProps {
  value?: string;
  placeholder?: string;
  size?: "sm" | "md";
  className?: string;
  onValueChange: (value: string) => void;
}

/** A native TimeField trigger backed by a manual "HH:MM" entry sheet. */
export function PickerTimeField({
  value,
  placeholder,
  className,
  onValueChange,
}: PickerTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    if (open) setDraft(value ?? "");
  }, [open, value]);

  return (
    <>
      <TimeField
        value={value}
        placeholder={placeholder}
        className={className}
        onPress={() => setOpen(true)}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title="Enter time">
        <View className="gap-3 pb-2">
          <Input
            placeholder="HH:MM"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            value={draft}
            onChangeText={setDraft}
          />
          <Button
            onPress={() => {
              if (draft.trim()) onValueChange(draft.trim());
              setOpen(false);
            }}
          >
            Done
          </Button>
        </View>
      </Sheet>
    </>
  );
}
