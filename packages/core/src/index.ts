// @inkd/core — shared domain layer for web + mobile.
//
// Platform-neutral surface. Platform session wiring lives in subpath exports
// (`@inkd/core/auth/web`, `@inkd/core/auth/mobile`) so the wrong platform's
// deps never enter a bundle.
export * from "./env";
export * from "./supabase";
export * from "./types";
export * from "./auth";
export * from "./api";
export * from "./booking";
export * from "./payments";
export * from "./hooks";
export * from "./domain/onboarding";
export * from "./agent";
export * from "./utils";
export * from "./waivers";
export * from "./reviews";
export * from "./tryon";
