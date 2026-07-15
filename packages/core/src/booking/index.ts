/**
 * @inkd/core booking domain — pure, platform-neutral logic shared by the web +
 * mobile booking pipeline UX: availability/slot projection and pipeline/money
 * derivations. No I/O; the data-access layer lives in `../api`.
 */
export * from "./slots";
export * from "./derive";
