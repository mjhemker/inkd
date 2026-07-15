/** Imperative handle every deferred-save editor exposes to its parent. */
export interface EditorHandle {
  /** Persist current form state. Resolves true on success, false on validation error. */
  save: () => Promise<boolean>;
}
