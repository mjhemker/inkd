/**
 * Onboarding + settings vocabulary. The canonical data now lives in
 * `@inkd/core` (shared with mobile); this file re-exports it so existing web
 * imports (and the components/artist barrel) keep working unchanged.
 */
export {
  CLASSIFICATIONS,
  AUTONOMY_LEVELS,
  AUTONOMY_BY_INDEX,
  BOOKING_WINDOWS,
  WEEKDAYS,
  STATE_OPTIONS,
  SERVICE_PRESETS,
  ACTION_CLASSES,
  STEP_META,
  type ServicePreset,
} from "@inkd/core";
