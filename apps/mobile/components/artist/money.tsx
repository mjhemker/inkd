import { Text } from "react-native";
import { Input, type InputProps } from "@inkd/ui/native";

/** cents → "1200" (no symbol) for display in inputs. */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toString();
}

/** cents → "$1,200" for read-only labels. */
export function formatMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/** A dollar string ("1200", "1,200.50") → integer cents, or null if blank. */
export function inputToCents(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (cleaned === "") return null;
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars)) return null;
  return Math.round(dollars * 100);
}

export interface MoneyInputProps extends Omit<InputProps, "onChangeText" | "value"> {
  /** Value in cents. */
  valueCents: number | null;
  onValueChange: (cents: number | null) => void;
}

/** A dollar-denominated input that stores integer cents. */
export function MoneyInput({ valueCents, onValueChange, ...props }: MoneyInputProps) {
  return (
    <Input
      inputMode="decimal"
      keyboardType="decimal-pad"
      placeholder="0"
      leadingIcon={<Text className="font-mono text-sm text-content-muted">$</Text>}
      value={centsToInput(valueCents)}
      onChangeText={(v) => onValueChange(inputToCents(v))}
      {...props}
    />
  );
}
