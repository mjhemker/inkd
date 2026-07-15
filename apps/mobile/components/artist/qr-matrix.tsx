import { View } from "react-native";
import QRCode from "qrcode";

export interface QrMatrixProps {
  value: string;
  /** Overall rendered size in px (square). */
  size?: number;
  moduleColor?: string;
  backgroundColor?: string;
}

/**
 * Renders a QR code as a plain grid of `View` squares — no canvas, no SVG, no
 * native module. `qrcode`'s low-level `create()` returns a bit matrix
 * synchronously in pure JS (only its higher-level `toDataURL`/`toCanvas`
 * helpers need a DOM canvas, which React Native doesn't have), so this works
 * identically on iOS/Android/web without any extra native dependency.
 */
export function QrMatrix({
  value,
  size = 180,
  moduleColor = "#0A0A0B",
  backgroundColor = "#FAFAFA",
}: QrMatrixProps) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const count = qr.modules.size;
  const cell = size / count;

  const cells = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      const on = qr.modules.get(row, col);
      cells.push(
        <View
          key={`${row}-${col}`}
          style={{
            width: cell,
            height: cell,
            backgroundColor: on ? moduleColor : backgroundColor,
          }}
        />,
      );
    }
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor,
        flexDirection: "row",
        flexWrap: "wrap",
      }}
    >
      {cells}
    </View>
  );
}
