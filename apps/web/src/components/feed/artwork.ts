/**
 * Deterministic gradient stand-ins for feed artwork. A framed near-black plate
 * with a violet- (or, for flash, ember-) leaning wash, picked stably from the
 * item id so a given piece always wears the same "frame" — and so the wall
 * reads as intentional even before (or without) real images. Mirrors the
 * gradient language already used on the marketing landing wall.
 */
const VIOLET_FRAMES = [
  "linear-gradient(155deg,#241733,#0a0a0b 72%)",
  "linear-gradient(155deg,#15213a,#0a0a0b 72%)",
  "linear-gradient(155deg,#331327,#0a0a0b 72%)",
  "linear-gradient(155deg,#1c1340,#0a0a0b 72%)",
  "linear-gradient(155deg,#2a1030,#0a0a0b 72%)",
  "linear-gradient(155deg,#101f33,#0a0a0b 72%)",
];

const EMBER_FRAME = "linear-gradient(155deg,#2b1b10,#0a0a0b 74%)";

export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function artworkGradient(seed: string, opts?: { ember?: boolean }): string {
  if (opts?.ember) return EMBER_FRAME;
  return VIOLET_FRAMES[hashString(seed) % VIOLET_FRAMES.length]!;
}
