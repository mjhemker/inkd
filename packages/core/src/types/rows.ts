/**
 * Ergonomic row / insert / update aliases over the generated `Database` type.
 *
 * These are the names the api + hooks layers use so call sites read as domain
 * language ("Service", "BookingRequest") rather than `Tables<'services'>`.
 */
import type {
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
} from "./database";

// --- Enum aliases -----------------------------------------------------------
export type ArtistClassificationEnum = Enums<"artist_classification">;
export type BookingWindow = Enums<"booking_window">;
export type ServicePriceType = Enums<"service_price_type">;
export type DepositType = Enums<"deposit_type">;
export type BookingRequestStatus = Enums<"booking_request_status">;
export type BookingStatus = Enums<"booking_status">;
export type SessionStatus = Enums<"session_status">;
export type PaymentKind = Enums<"payment_kind">;
export type PaymentStatus = Enums<"payment_status">;
export type UsState = Enums<"us_state">;
export type AvailabilityBlockType = Enums<"availability_block_type">;
export type SenderKind = Enums<"sender_kind">;
export type ThreadStatus = Enums<"thread_status">;
export type PostSource = Enums<"post_source">;
export type AgentAutonomyEnum = Enums<"agent_autonomy">;
export type AgentRole = Enums<"agent_role">;
export type AgentActionStatus = Enums<"agent_action_status">;
export type PlaybookCategory = Enums<"playbook_category">;
export type PlaybookSource = Enums<"playbook_source">;

// --- Row aliases ------------------------------------------------------------
export type Profile = Tables<"profiles">;
export type ArtistProfile = Tables<"artist_profiles">;
export type StudioLocation = Tables<"studio_locations">;
export type Style = Tables<"styles">;
export type ArtistStyle = Tables<"artist_styles">;
export type Service = Tables<"services">;
export type AvailabilityRule = Tables<"availability_rules">;
export type AvailabilityBlock = Tables<"availability_blocks">;
export type BookingPolicy = Tables<"booking_policies">;
export type BookingRequest = Tables<"booking_requests">;
export type Booking = Tables<"bookings">;
export type Session = Tables<"sessions">;
export type Payment = Tables<"payments">;
export type WaiverTemplate = Tables<"waiver_templates">;
export type SignedWaiver = Tables<"signed_waivers">;
export type Thread = Tables<"threads">;
export type Message = Tables<"messages">;
export type Post = Tables<"posts">;
export type PortfolioPiece = Tables<"portfolio_pieces">;
export type FlashSheet = Tables<"flash_sheets">;
export type FlashItem = Tables<"flash_items">;
export type Review = Tables<"reviews">;
export type Follow = Tables<"follows">;
export type PostLike = Tables<"post_likes">;
export type AgentSettings = Tables<"agent_settings">;
export type AgentAction = Tables<"agent_actions">;
export type AgentPlaybook = Tables<"agent_playbooks">;
export type Notification = Tables<"notifications">;

// --- Insert aliases (only the ones the api layer mutates through) -----------
export type ProfileInsert = TablesInsert<"profiles">;
export type ArtistProfileInsert = TablesInsert<"artist_profiles">;
export type StudioLocationInsert = TablesInsert<"studio_locations">;
export type ServiceInsert = TablesInsert<"services">;
export type AvailabilityRuleInsert = TablesInsert<"availability_rules">;
export type AvailabilityBlockInsert = TablesInsert<"availability_blocks">;
export type BookingPolicyInsert = TablesInsert<"booking_policies">;
export type BookingRequestInsert = TablesInsert<"booking_requests">;
export type BookingInsert = TablesInsert<"bookings">;
export type SessionInsert = TablesInsert<"sessions">;
export type WaiverTemplateInsert = TablesInsert<"waiver_templates">;
export type SignedWaiverInsert = TablesInsert<"signed_waivers">;
export type ThreadInsert = TablesInsert<"threads">;
export type MessageInsert = TablesInsert<"messages">;
export type PostInsert = TablesInsert<"posts">;
export type PortfolioPieceInsert = TablesInsert<"portfolio_pieces">;
export type FlashSheetInsert = TablesInsert<"flash_sheets">;
export type FlashItemInsert = TablesInsert<"flash_items">;
export type ReviewInsert = TablesInsert<"reviews">;
export type AgentSettingsInsert = TablesInsert<"agent_settings">;
export type NotificationInsert = TablesInsert<"notifications">;

// --- Update aliases ---------------------------------------------------------
export type ProfileUpdate = TablesUpdate<"profiles">;
export type ArtistProfileUpdate = TablesUpdate<"artist_profiles">;
export type StudioLocationUpdate = TablesUpdate<"studio_locations">;
export type ServiceUpdate = TablesUpdate<"services">;
export type AvailabilityRuleUpdate = TablesUpdate<"availability_rules">;
export type AvailabilityBlockUpdate = TablesUpdate<"availability_blocks">;
export type BookingPolicyUpdate = TablesUpdate<"booking_policies">;
export type BookingRequestUpdate = TablesUpdate<"booking_requests">;
export type BookingUpdate = TablesUpdate<"bookings">;
export type SessionUpdate = TablesUpdate<"sessions">;
export type ThreadUpdate = TablesUpdate<"threads">;
export type AgentSettingsUpdate = TablesUpdate<"agent_settings">;
export type NotificationUpdate = TablesUpdate<"notifications">;
export type ReviewUpdate = TablesUpdate<"reviews">;
