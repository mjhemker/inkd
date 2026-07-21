import { Children, type ReactNode } from "react";

/**
 * True when a child is a bare string or number — the exact node type that
 * React Native refuses to render outside a `<Text>` ("Text strings must be
 * rendered within a <Text> component"). Kept renderer-free and pure so the
 * crash-guard contract can be unit-tested in node.
 */
export function isBareTextChild(child: ReactNode): child is string | number {
  // NaN would render as the string "NaN" in RN, so numbers (incl. NaN) count.
  return typeof child === "string" || typeof child === "number";
}

/**
 * Wrap every bare string/number child of a container in a caller-supplied
 * `<Text>` element while passing real elements straight through. This is the
 * primitive-level guard: any View-based primitive (Badge, Chip, Button…) can
 * accept string, number, OR mixed/array children (e.g. the JSX `@ {name}`,
 * which React hands over as the array `["@ ", name]`) without ever leaking a
 * raw string into a `<View>`.
 */
export function wrapTextChildren(
  children: ReactNode,
  renderText: (child: string | number, key: number) => ReactNode,
): ReactNode {
  return Children.map(children, (child, index) =>
    isBareTextChild(child) ? renderText(child, index) : child,
  );
}
