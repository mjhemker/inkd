import { ActivityIndicator } from "react-native";

export interface SpinnerProps {
  size?: "small" | "large";
  color?: string;
}

export function Spinner({ size = "small", color = "#A78BFA" }: SpinnerProps) {
  return <ActivityIndicator size={size} color={color} />;
}
