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
export * from "./discover";
export * from "./availability";
export * from "./booking";
export * from "./bookingFlow";
export * from "./uploads";
export * from "./payments";
export * from "./messaging";
export * from "./content";
export * from "./waivers";
export * from "./waiverTemplateManagement";
export * from "./agentSettings";
export * from "./agentActions";
export * from "./playbooks";
export * from "./notifications";
export * from "./notificationPreferences";
export * from "./threadDirectory";
export * from "./threadStarter";
export * from "./contentExtras";
export * from "./media";
export * from "./chatAttachments";
export * from "./feed";
export * from "./social";
export * from "./reviews";
export * from "./instagram";
export * from "./plan";
export * from "./dashboardStats";
export * from "./similarWorks";
export * from "./aftercare";
