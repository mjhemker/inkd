/**
 * Tiny dependency-free className joiner shared by the web and native primitives.
 * Filters falsy values and flattens nested arrays. Not a Tailwind-merge — order
 * still matters, so keep conditional classes non-conflicting.
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[];

export function cx(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === "string" || typeof input === "number") {
      out.push(String(input));
    } else if (Array.isArray(input)) {
      const nested = cx(...input);
      if (nested) out.push(nested);
    }
  }
  return out.join(" ");
}
