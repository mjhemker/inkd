/**
 * INKD typed data-access layer. These functions are the ONLY database surface
 * app screens should call — each takes an RLS-scoped Supabase client, validates
 * input with zod, and returns narrow types. No service-role usage.
 */
export * from "./helpers";
export * from "./profiles";
export * from "./artistProfiles";
export * from "./studioLocations";
export * from "./services";
export * from "./availability";
export * from "./booking";
export * from "./messaging";
export * from "./content";
export * from "./waivers";
export * from "./agentSettings";
export * from "./notifications";
