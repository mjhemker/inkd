/**
 * Generated Supabase database types for INKD.
 *
 * Source of truth: the SQL migrations in `supabase/migrations/`.
 * Regenerate with the Supabase `generate_typescript_types` tool (project
 * khlpidflnvkqafkvkpfy) whenever the schema changes — do NOT hand-edit.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      aftercare_checkins: {
        Row: {
          artist_id: string
          booking_id: string | null
          client_id: string
          consent_to_share: boolean
          created_at: string
          healing_rating: number | null
          id: string
          kind: Database["public"]["Enums"]["aftercare_checkin_kind"]
          note: string | null
          photo_path: string | null
          responded_at: string | null
          scheduled_for: string
          sent_at: string | null
          session_id: string
          shared_as_portfolio_piece_id: string | null
          status: Database["public"]["Enums"]["aftercare_checkin_status"]
          updated_at: string
        }
        Insert: {
          artist_id: string
          booking_id?: string | null
          client_id: string
          consent_to_share?: boolean
          created_at?: string
          healing_rating?: number | null
          id?: string
          kind: Database["public"]["Enums"]["aftercare_checkin_kind"]
          note?: string | null
          photo_path?: string | null
          responded_at?: string | null
          scheduled_for: string
          sent_at?: string | null
          session_id: string
          shared_as_portfolio_piece_id?: string | null
          status?: Database["public"]["Enums"]["aftercare_checkin_status"]
          updated_at?: string
        }
        Update: {
          artist_id?: string
          booking_id?: string | null
          client_id?: string
          consent_to_share?: boolean
          created_at?: string
          healing_rating?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["aftercare_checkin_kind"]
          note?: string | null
          photo_path?: string | null
          responded_at?: string | null
          scheduled_for?: string
          sent_at?: string | null
          session_id?: string
          shared_as_portfolio_piece_id?: string | null
          status?: Database["public"]["Enums"]["aftercare_checkin_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aftercare_checkins_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aftercare_checkins_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aftercare_checkins_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aftercare_checkins_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aftercare_checkins_shared_as_portfolio_piece_id_fkey"
            columns: ["shared_as_portfolio_piece_id"]
            isOneToOne: false
            referencedRelation: "portfolio_pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_actions: {
        Row: {
          action_type: string
          agent_role: Database["public"]["Enums"]["agent_role"] | null
          approved_at: string | null
          approved_by: string | null
          artist_id: string
          booking_id: string | null
          booking_request_id: string | null
          client_id: string | null
          created_at: string
          data_consulted: Json
          dedupe_key: string | null
          executed_at: string | null
          executed_message_id: string | null
          id: string
          payload: Json
          proposed_at: string
          reasoning_summary: string | null
          rejected_at: string | null
          result: Json | null
          session_id: string | null
          status: Database["public"]["Enums"]["agent_action_status"]
          thread_id: string | null
          tier: number
          updated_at: string
        }
        Insert: {
          action_type: string
          agent_role?: Database["public"]["Enums"]["agent_role"] | null
          approved_at?: string | null
          approved_by?: string | null
          artist_id: string
          booking_id?: string | null
          booking_request_id?: string | null
          client_id?: string | null
          created_at?: string
          data_consulted?: Json
          dedupe_key?: string | null
          executed_at?: string | null
          executed_message_id?: string | null
          id?: string
          payload?: Json
          proposed_at?: string
          reasoning_summary?: string | null
          rejected_at?: string | null
          result?: Json | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["agent_action_status"]
          thread_id?: string | null
          tier: number
          updated_at?: string
        }
        Update: {
          action_type?: string
          agent_role?: Database["public"]["Enums"]["agent_role"] | null
          approved_at?: string | null
          approved_by?: string | null
          artist_id?: string
          booking_id?: string | null
          booking_request_id?: string | null
          client_id?: string | null
          created_at?: string
          data_consulted?: Json
          dedupe_key?: string | null
          executed_at?: string | null
          executed_message_id?: string | null
          id?: string
          payload?: Json
          proposed_at?: string
          reasoning_summary?: string | null
          rejected_at?: string | null
          result?: Json | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["agent_action_status"]
          thread_id?: string | null
          tier?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_actions_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_actions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_actions_booking_request_id_fkey"
            columns: ["booking_request_id"]
            isOneToOne: false
            referencedRelation: "booking_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_actions_executed_message_id_fkey"
            columns: ["executed_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_actions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_actions_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_jobs: {
        Row: {
          artist_id: string
          attempts: number
          booking_request_id: string | null
          created_at: string
          dedupe_key: string
          id: string
          job_kind: string | null
          last_error: string | null
          leased_at: string | null
          max_attempts: number
          scheduled_at: string
          status: string
          thread_id: string | null
          trigger_id: string
          trigger_kind: string
          updated_at: string
        }
        Insert: {
          artist_id: string
          attempts?: number
          booking_request_id?: string | null
          created_at?: string
          dedupe_key: string
          id?: string
          job_kind?: string | null
          last_error?: string | null
          leased_at?: string | null
          max_attempts?: number
          scheduled_at?: string
          status?: string
          thread_id?: string | null
          trigger_id: string
          trigger_kind: string
          updated_at?: string
        }
        Update: {
          artist_id?: string
          attempts?: number
          booking_request_id?: string | null
          created_at?: string
          dedupe_key?: string
          id?: string
          job_kind?: string | null
          last_error?: string | null
          leased_at?: string | null
          max_attempts?: number
          scheduled_at?: string
          status?: string
          thread_id?: string | null
          trigger_id?: string
          trigger_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_jobs_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_jobs_booking_request_id_fkey"
            columns: ["booking_request_id"]
            isOneToOne: false
            referencedRelation: "booking_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_jobs_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_playbooks: {
        Row: {
          artist_id: string
          category: Database["public"]["Enums"]["playbook_category"]
          content: string
          created_at: string
          id: string
          is_active: boolean
          priority: number
          source: Database["public"]["Enums"]["playbook_source"]
          title: string | null
          updated_at: string
        }
        Insert: {
          artist_id: string
          category?: Database["public"]["Enums"]["playbook_category"]
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          source?: Database["public"]["Enums"]["playbook_source"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          artist_id?: string
          category?: Database["public"]["Enums"]["playbook_category"]
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          source?: Database["public"]["Enums"]["playbook_source"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_playbooks_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_settings: {
        Row: {
          action_class_overrides: Json
          artist_id: string
          autonomy: Database["public"]["Enums"]["agent_autonomy"]
          booking_manager_enabled: boolean
          client_disclosure_enabled: boolean
          created_at: string
          escalation_keywords: string[]
          front_desk_enabled: boolean
          growth_advisor_enabled: boolean
          id: string
          quote_max_cents: number | null
          quote_min_cents: number | null
          studio_manager_enabled: boolean
          updated_at: string
        }
        Insert: {
          action_class_overrides?: Json
          artist_id: string
          autonomy?: Database["public"]["Enums"]["agent_autonomy"]
          booking_manager_enabled?: boolean
          client_disclosure_enabled?: boolean
          created_at?: string
          escalation_keywords?: string[]
          front_desk_enabled?: boolean
          growth_advisor_enabled?: boolean
          id?: string
          quote_max_cents?: number | null
          quote_min_cents?: number | null
          studio_manager_enabled?: boolean
          updated_at?: string
        }
        Update: {
          action_class_overrides?: Json
          artist_id?: string
          autonomy?: Database["public"]["Enums"]["agent_autonomy"]
          booking_manager_enabled?: boolean
          client_disclosure_enabled?: boolean
          created_at?: string
          escalation_keywords?: string[]
          front_desk_enabled?: boolean
          growth_advisor_enabled?: boolean
          id?: string
          quote_max_cents?: number | null
          quote_min_cents?: number | null
          studio_manager_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_settings_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: true
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_profiles: {
        Row: {
          accepts_new_clients: boolean
          aftercare_enabled: boolean
          bio: string | null
          classification:
            | Database["public"]["Enums"]["artist_classification"]
            | null
          created_at: string
          id: string
          instagram_handle: string | null
          is_published: boolean
          onboarding_completed_at: string | null
          onboarding_step: number
          plan: string
          profile_id: string
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_details_submitted: boolean
          stripe_identity_verified: boolean
          stripe_onboarding_completed_at: string | null
          stripe_payouts_enabled: boolean
          styles: string[]
          tagline: string | null
          travel_at_home: boolean
          travel_fly_out: boolean
          travel_house_calls: boolean
          updated_at: string
          waitlist_enabled: boolean
          years_experience: number | null
        }
        Insert: {
          accepts_new_clients?: boolean
          aftercare_enabled?: boolean
          bio?: string | null
          classification?:
            | Database["public"]["Enums"]["artist_classification"]
            | null
          created_at?: string
          id?: string
          instagram_handle?: string | null
          is_published?: boolean
          onboarding_completed_at?: string | null
          onboarding_step?: number
          plan?: string
          profile_id: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          stripe_identity_verified?: boolean
          stripe_onboarding_completed_at?: string | null
          stripe_payouts_enabled?: boolean
          styles?: string[]
          tagline?: string | null
          travel_at_home?: boolean
          travel_fly_out?: boolean
          travel_house_calls?: boolean
          updated_at?: string
          waitlist_enabled?: boolean
          years_experience?: number | null
        }
        Update: {
          accepts_new_clients?: boolean
          aftercare_enabled?: boolean
          bio?: string | null
          classification?:
            | Database["public"]["Enums"]["artist_classification"]
            | null
          created_at?: string
          id?: string
          instagram_handle?: string | null
          is_published?: boolean
          onboarding_completed_at?: string | null
          onboarding_step?: number
          plan?: string
          profile_id?: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          stripe_identity_verified?: boolean
          stripe_onboarding_completed_at?: string | null
          stripe_payouts_enabled?: boolean
          styles?: string[]
          tagline?: string | null
          travel_at_home?: boolean
          travel_fly_out?: boolean
          travel_house_calls?: boolean
          updated_at?: string
          waitlist_enabled?: boolean
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_styles: {
        Row: {
          artist_id: string
          created_at: string
          style_id: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          style_id: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          style_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_styles_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_styles_style_id_fkey"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "styles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_blocks: {
        Row: {
          artist_id: string
          block_type: Database["public"]["Enums"]["availability_block_type"]
          created_at: string
          ends_at: string
          id: string
          is_available: boolean
          location_id: string | null
          reason: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          artist_id: string
          block_type?: Database["public"]["Enums"]["availability_block_type"]
          created_at?: string
          ends_at: string
          id?: string
          is_available?: boolean
          location_id?: string | null
          reason?: string | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          artist_id?: string
          block_type?: Database["public"]["Enums"]["availability_block_type"]
          created_at?: string
          ends_at?: string
          id?: string
          is_available?: boolean
          location_id?: string | null
          reason?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_blocks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "studio_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          artist_id: string
          created_at: string
          end_time: string
          id: string
          is_open: boolean
          location_id: string | null
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          artist_id: string
          created_at?: string
          end_time: string
          id?: string
          is_open?: boolean
          location_id?: string | null
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          artist_id?: string
          created_at?: string
          end_time?: string
          id?: string
          is_open?: boolean
          location_id?: string | null
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "studio_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_policies: {
        Row: {
          allow_document_uploads: boolean
          allow_image_uploads: boolean
          artist_id: string
          auto_decline_when_closed: boolean
          booking_window: Database["public"]["Enums"]["booking_window"]
          created_at: string
          custom_intake_fields: Json
          id: string
          max_active_requests: number | null
          min_notice_hours: number
          require_medical_disclosure: boolean
          updated_at: string
        }
        Insert: {
          allow_document_uploads?: boolean
          allow_image_uploads?: boolean
          artist_id: string
          auto_decline_when_closed?: boolean
          booking_window?: Database["public"]["Enums"]["booking_window"]
          created_at?: string
          custom_intake_fields?: Json
          id?: string
          max_active_requests?: number | null
          min_notice_hours?: number
          require_medical_disclosure?: boolean
          updated_at?: string
        }
        Update: {
          allow_document_uploads?: boolean
          allow_image_uploads?: boolean
          artist_id?: string
          auto_decline_when_closed?: boolean
          booking_window?: Database["public"]["Enums"]["booking_window"]
          created_at?: string
          custom_intake_fields?: Json
          id?: string
          max_active_requests?: number | null
          min_notice_hours?: number
          require_medical_disclosure?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_policies_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: true
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_requests: {
        Row: {
          artist_id: string
          budget_max_cents: number | null
          budget_min_cents: number | null
          client_id: string
          created_at: string
          description: string | null
          has_medical_flags: boolean
          id: string
          is_cover_up: boolean
          is_first_tattoo: boolean | null
          location_id: string | null
          medical_notes: string | null
          placement: string | null
          placement_region: string | null
          placement_side: string | null
          placement_view: string | null
          preferred_dates: Json
          reference_uploads: Json
          service_id: string | null
          size_description: string | null
          status: Database["public"]["Enums"]["booking_request_status"]
          updated_at: string
        }
        Insert: {
          artist_id: string
          budget_max_cents?: number | null
          budget_min_cents?: number | null
          client_id: string
          created_at?: string
          description?: string | null
          has_medical_flags?: boolean
          id?: string
          is_cover_up?: boolean
          is_first_tattoo?: boolean | null
          location_id?: string | null
          medical_notes?: string | null
          placement?: string | null
          placement_region?: string | null
          placement_side?: string | null
          placement_view?: string | null
          preferred_dates?: Json
          reference_uploads?: Json
          service_id?: string | null
          size_description?: string | null
          status?: Database["public"]["Enums"]["booking_request_status"]
          updated_at?: string
        }
        Update: {
          artist_id?: string
          budget_max_cents?: number | null
          budget_min_cents?: number | null
          client_id?: string
          created_at?: string
          description?: string | null
          has_medical_flags?: boolean
          id?: string
          is_cover_up?: boolean
          is_first_tattoo?: boolean | null
          location_id?: string | null
          medical_notes?: string | null
          placement?: string | null
          placement_region?: string | null
          placement_side?: string | null
          placement_view?: string | null
          preferred_dates?: Json
          reference_uploads?: Json
          service_id?: string | null
          size_description?: string | null
          status?: Database["public"]["Enums"]["booking_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "studio_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          artist_id: string
          client_id: string
          created_at: string
          deposit_cents: number | null
          id: string
          notes: string | null
          request_id: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["booking_status"]
          title: string | null
          total_price_cents: number | null
          updated_at: string
        }
        Insert: {
          artist_id: string
          client_id: string
          created_at?: string
          deposit_cents?: number | null
          id?: string
          notes?: string | null
          request_id?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          title?: string | null
          total_price_cents?: number | null
          updated_at?: string
        }
        Update: {
          artist_id?: string
          client_id?: string
          created_at?: string
          deposit_cents?: number | null
          id?: string
          notes?: string | null
          request_id?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          title?: string | null
          total_price_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "booking_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_drops: {
        Row: {
          artist_id: string | null
          clicked_at: string | null
          created_at: string
          drop_date: string
          generated_at: string
          id: string
          is_cold_start: boolean
          reacted_at: string | null
          reason: string
          reason_style: string | null
          score: number | null
          seen_at: string | null
          subject_id: string
          subject_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          artist_id?: string | null
          clicked_at?: string | null
          created_at?: string
          drop_date: string
          generated_at?: string
          id?: string
          is_cold_start?: boolean
          reacted_at?: string | null
          reason: string
          reason_style?: string | null
          score?: number | null
          seen_at?: string | null
          subject_id: string
          subject_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          artist_id?: string | null
          clicked_at?: string | null
          created_at?: string
          drop_date?: string
          generated_at?: string
          id?: string
          is_cold_start?: boolean
          reacted_at?: string | null
          reason?: string
          reason_style?: string | null
          score?: number | null
          seen_at?: string | null
          subject_id?: string
          subject_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_drops_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_drops_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_push_tokens: {
        Row: {
          created_at: string
          expo_push_token: string
          id: string
          last_seen: string
          platform: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expo_push_token: string
          id?: string
          last_seen?: string
          platform: string
          user_id: string
        }
        Update: {
          created_at?: string
          expo_push_token?: string
          id?: string
          last_seen?: string
          platform?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_items: {
        Row: {
          artist_id: string
          created_at: string
          flash_sheet_id: string
          id: string
          image_url: string | null
          is_available: boolean
          is_repeatable: boolean
          placement_suggestion: string | null
          price_cents: number | null
          size_inches: number | null
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          flash_sheet_id: string
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_repeatable?: boolean
          placement_suggestion?: string | null
          price_cents?: number | null
          size_inches?: number | null
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          flash_sheet_id?: string
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_repeatable?: boolean
          placement_suggestion?: string | null
          price_cents?: number | null
          size_inches?: number | null
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_items_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_items_flash_sheet_id_fkey"
            columns: ["flash_sheet_id"]
            isOneToOne: false
            referencedRelation: "flash_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_sheets: {
        Row: {
          artist_id: string
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          title: string | null
          updated_at: string
        }
        Insert: {
          artist_id: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          title?: string | null
          updated_at?: string
        }
        Update: {
          artist_id?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_sheets_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          artist_id: string
          created_at: string
          follower_id: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          follower_id: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      geocode_cache: {
        Row: {
          created_at: string
          display_name: string | null
          hit_count: number
          id: string
          lat: number | null
          lng: number | null
          provider: string
          query: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          hit_count?: number
          id?: string
          lat?: number | null
          lng?: number | null
          provider?: string
          query: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          hit_count?: number
          id?: string
          lat?: number | null
          lng?: number | null
          provider?: string
          query?: string
          updated_at?: string
        }
        Relationships: []
      }
      image_tag_jobs: {
        Row: {
          artist_id: string | null
          attempts: number
          created_at: string
          dedupe_key: string
          id: string
          image_url: string | null
          last_error: string | null
          leased_at: string | null
          max_attempts: number
          scheduled_at: string
          status: string
          subject_id: string
          subject_type: Database["public"]["Enums"]["image_subject_type"]
          updated_at: string
        }
        Insert: {
          artist_id?: string | null
          attempts?: number
          created_at?: string
          dedupe_key: string
          id?: string
          image_url?: string | null
          last_error?: string | null
          leased_at?: string | null
          max_attempts?: number
          scheduled_at?: string
          status?: string
          subject_id: string
          subject_type: Database["public"]["Enums"]["image_subject_type"]
          updated_at?: string
        }
        Update: {
          artist_id?: string | null
          attempts?: number
          created_at?: string
          dedupe_key?: string
          id?: string
          image_url?: string | null
          last_error?: string | null
          leased_at?: string | null
          max_attempts?: number
          scheduled_at?: string
          status?: string
          subject_id?: string
          subject_type?: Database["public"]["Enums"]["image_subject_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_tag_jobs_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      image_tags: {
        Row: {
          artist_id: string | null
          color_type: Database["public"]["Enums"]["image_color_type"]
          created_at: string
          description: string | null
          embedding: string | null
          id: string
          image_url: string | null
          model_version: string
          placement: string[]
          size_estimate: Database["public"]["Enums"]["image_size_estimate"]
          style_confidences: number[]
          styles: string[]
          subject_id: string
          subject_matter: string[]
          subject_type: Database["public"]["Enums"]["image_subject_type"]
          tagged_at: string
          updated_at: string
        }
        Insert: {
          artist_id?: string | null
          color_type?: Database["public"]["Enums"]["image_color_type"]
          created_at?: string
          description?: string | null
          embedding?: string | null
          id?: string
          image_url?: string | null
          model_version: string
          placement?: string[]
          size_estimate?: Database["public"]["Enums"]["image_size_estimate"]
          style_confidences?: number[]
          styles?: string[]
          subject_id: string
          subject_matter?: string[]
          subject_type: Database["public"]["Enums"]["image_subject_type"]
          tagged_at?: string
          updated_at?: string
        }
        Update: {
          artist_id?: string | null
          color_type?: Database["public"]["Enums"]["image_color_type"]
          created_at?: string
          description?: string | null
          embedding?: string | null
          id?: string
          image_url?: string | null
          model_version?: string
          placement?: string[]
          size_estimate?: Database["public"]["Enums"]["image_size_estimate"]
          style_confidences?: number[]
          styles?: string[]
          subject_id?: string
          subject_matter?: string[]
          subject_type?: Database["public"]["Enums"]["image_subject_type"]
          tagged_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_tags_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_connections: {
        Row: {
          access_token: string
          artist_id: string
          connected_at: string
          created_at: string
          id: string
          ig_user_id: string
          ig_username: string | null
          last_refreshed_at: string | null
          last_synced_at: string | null
          scopes: string[]
          token_expires_at: string
          updated_at: string
        }
        Insert: {
          access_token: string
          artist_id: string
          connected_at?: string
          created_at?: string
          id?: string
          ig_user_id: string
          ig_username?: string | null
          last_refreshed_at?: string | null
          last_synced_at?: string | null
          scopes?: string[]
          token_expires_at: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          artist_id?: string
          connected_at?: string
          created_at?: string
          id?: string
          ig_user_id?: string
          ig_username?: string | null
          last_refreshed_at?: string | null
          last_synced_at?: string | null
          scopes?: string[]
          token_expires_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_connections_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_import_runs: {
        Row: {
          already_imported: number
          artist_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          media_seen: number
          media_skipped: number
          pieces_created: number
          posts_created: number
          started_at: string | null
          status: string
        }
        Insert: {
          already_imported?: number
          artist_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          media_seen?: number
          media_skipped?: number
          pieces_created?: number
          posts_created?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          already_imported?: number
          artist_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          media_seen?: number
          media_skipped?: number
          pieces_created?: number
          posts_created?: number
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_import_runs_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          agent_action_id: string | null
          attachments: Json
          body: string | null
          created_at: string
          drafted_by_agent: boolean
          id: string
          is_read: boolean
          read_at: string | null
          sender_kind: Database["public"]["Enums"]["sender_kind"]
          sender_profile_id: string | null
          thread_id: string
          updated_at: string
        }
        Insert: {
          agent_action_id?: string | null
          attachments?: Json
          body?: string | null
          created_at?: string
          drafted_by_agent?: boolean
          id?: string
          is_read?: boolean
          read_at?: string | null
          sender_kind: Database["public"]["Enums"]["sender_kind"]
          sender_profile_id?: string | null
          thread_id: string
          updated_at?: string
        }
        Update: {
          agent_action_id?: string | null
          attachments?: Json
          body?: string | null
          created_at?: string
          drafted_by_agent?: boolean
          id?: string
          is_read?: boolean
          read_at?: string | null
          sender_kind?: Database["public"]["Enums"]["sender_kind"]
          sender_profile_id?: string | null
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_agent_action_id_fkey"
            columns: ["agent_action_id"]
            isOneToOne: false
            referencedRelation: "agent_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          notification_id: string
          provider_ref: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          notification_id: string
          provider_ref?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          notification_id?: string
          provider_ref?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category: string
          email: boolean
          in_app: boolean
          push: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          email?: boolean
          in_app?: boolean
          push?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          email?: boolean
          in_app?: boolean
          push?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          data: Json
          id: string
          is_read: boolean
          profile_id: string
          read_at: string | null
          title: string | null
          type: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          profile_id: string
          read_at?: string | null
          title?: string | null
          type: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          profile_id?: string
          read_at?: string | null
          title?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          artist_id: string
          booking_id: string | null
          client_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          inkd_fee_cents: number
          kind: Database["public"]["Enums"]["payment_kind"]
          metadata: Json
          processed_at: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          stripe_transfer_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          artist_id: string
          booking_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          inkd_fee_cents?: number
          kind: Database["public"]["Enums"]["payment_kind"]
          metadata?: Json
          processed_at?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          artist_id?: string
          booking_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          inkd_fee_cents?: number
          kind?: Database["public"]["Enums"]["payment_kind"]
          metadata?: Json
          processed_at?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_pieces: {
        Row: {
          artist_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          instagram_media_id: string | null
          is_healed: boolean | null
          is_public: boolean
          placement: string | null
          post_id: string | null
          sort_order: number
          style_tags: string[]
          title: string | null
          updated_at: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          instagram_media_id?: string | null
          is_healed?: boolean | null
          is_public?: boolean
          placement?: string | null
          post_id?: string | null
          sort_order?: number
          style_tags?: string[]
          title?: string | null
          updated_at?: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          instagram_media_id?: string | null
          is_healed?: boolean | null
          is_public?: boolean
          placement?: string | null
          post_id?: string | null
          sort_order?: number
          style_tags?: string[]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_pieces_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_pieces_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_styles: {
        Row: {
          artist_id: string
          created_at: string
          post_id: string
          style_id: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          post_id: string
          style_id: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          post_id?: string
          style_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_styles_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_styles_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_styles_style_id_fkey"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "styles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          artist_id: string
          caption: string | null
          cover_url: string | null
          created_at: string
          id: string
          instagram_id: string | null
          instagram_permalink: string | null
          is_public: boolean
          like_count: number
          media: Json
          source: Database["public"]["Enums"]["post_source"]
          updated_at: string
        }
        Insert: {
          artist_id: string
          caption?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          instagram_id?: string | null
          instagram_permalink?: string | null
          is_public?: boolean
          like_count?: number
          media?: Json
          source?: Database["public"]["Enums"]["post_source"]
          updated_at?: string
        }
        Update: {
          artist_id?: string
          caption?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          instagram_id?: string | null
          instagram_permalink?: string | null
          is_public?: boolean
          like_count?: number
          media?: Json
          source?: Database["public"]["Enums"]["post_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          display_name: string | null
          email: string | null
          handle: string | null
          id: string
          is_artist: boolean
          is_public: boolean
          phone: string | null
          state: Database["public"]["Enums"]["us_state"] | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          handle?: string | null
          id: string
          is_artist?: boolean
          is_public?: boolean
          phone?: string | null
          state?: Database["public"]["Enums"]["us_state"] | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          handle?: string | null
          id?: string
          is_artist?: boolean
          is_public?: boolean
          phone?: string | null
          state?: Database["public"]["Enums"]["us_state"] | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          artist_id: string
          artist_response: string | null
          body: string | null
          booking_id: string | null
          client_id: string
          created_at: string
          id: string
          is_public: boolean
          rating: number
          title: string | null
          updated_at: string
        }
        Insert: {
          artist_id: string
          artist_response?: string | null
          body?: string | null
          booking_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_public?: boolean
          rating: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          artist_id?: string
          artist_response?: string | null
          body?: string | null
          booking_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_public?: boolean
          rating?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          created_at: string
          post_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          add_ons: Json
          artist_id: string
          break_time_minutes: number
          calendar_ref: string | null
          created_at: string
          deposit_amount_cents: number | null
          deposit_percent: number | null
          deposit_type: Database["public"]["Enums"]["deposit_type"]
          description: string | null
          duration_minutes: number | null
          id: string
          is_preset: boolean
          is_public: boolean
          lead_time_hours: number
          location_id: string | null
          name: string
          preset_key: string | null
          price_cents: number | null
          price_type: Database["public"]["Enums"]["service_price_type"]
          sort_order: number
          updated_at: string
          video_conferencing: boolean
        }
        Insert: {
          add_ons?: Json
          artist_id: string
          break_time_minutes?: number
          calendar_ref?: string | null
          created_at?: string
          deposit_amount_cents?: number | null
          deposit_percent?: number | null
          deposit_type?: Database["public"]["Enums"]["deposit_type"]
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_preset?: boolean
          is_public?: boolean
          lead_time_hours?: number
          location_id?: string | null
          name: string
          preset_key?: string | null
          price_cents?: number | null
          price_type?: Database["public"]["Enums"]["service_price_type"]
          sort_order?: number
          updated_at?: string
          video_conferencing?: boolean
        }
        Update: {
          add_ons?: Json
          artist_id?: string
          break_time_minutes?: number
          calendar_ref?: string | null
          created_at?: string
          deposit_amount_cents?: number | null
          deposit_percent?: number | null
          deposit_type?: Database["public"]["Enums"]["deposit_type"]
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_preset?: boolean
          is_public?: boolean
          lead_time_hours?: number
          location_id?: string | null
          name?: string
          preset_key?: string | null
          price_cents?: number | null
          price_type?: Database["public"]["Enums"]["service_price_type"]
          sort_order?: number
          updated_at?: string
          video_conferencing?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "services_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "studio_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          artist_id: string
          balance_cents: number
          balance_paid: boolean
          booking_id: string
          client_id: string
          created_at: string
          deposit_cents: number
          deposit_paid: boolean
          duration_minutes: number | null
          id: string
          location_id: string | null
          notes: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          session_number: number
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
        }
        Insert: {
          artist_id: string
          balance_cents?: number
          balance_paid?: boolean
          booking_id: string
          client_id: string
          created_at?: string
          deposit_cents?: number
          deposit_paid?: boolean
          duration_minutes?: number | null
          id?: string
          location_id?: string | null
          notes?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          session_number?: number
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Update: {
          artist_id?: string
          balance_cents?: number
          balance_paid?: boolean
          booking_id?: string
          client_id?: string
          created_at?: string
          deposit_cents?: number
          deposit_paid?: boolean
          duration_minutes?: number | null
          id?: string
          location_id?: string | null
          notes?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          session_number?: number
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "studio_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_members: {
        Row: {
          artist_profile_id: string
          created_at: string
          id: string
          invited_at: string
          invited_by: string | null
          joined_at: string | null
          membership_mode: Database["public"]["Enums"]["shop_membership_mode"]
          role: Database["public"]["Enums"]["shop_member_role"]
          shop_id: string
          status: Database["public"]["Enums"]["shop_member_status"]
          updated_at: string
        }
        Insert: {
          artist_profile_id: string
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          joined_at?: string | null
          membership_mode?: Database["public"]["Enums"]["shop_membership_mode"]
          role?: Database["public"]["Enums"]["shop_member_role"]
          shop_id: string
          status?: Database["public"]["Enums"]["shop_member_status"]
          updated_at?: string
        }
        Update: {
          artist_profile_id?: string
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          joined_at?: string | null
          membership_mode?: Database["public"]["Enums"]["shop_membership_mode"]
          role?: Database["public"]["Enums"]["shop_member_role"]
          shop_id?: string
          status?: Database["public"]["Enums"]["shop_member_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_members_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_members_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          handle: string
          id: string
          is_published: boolean
          name: string
          owner_artist_id: string
          primary_location_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          handle: string
          id?: string
          is_published?: boolean
          name: string
          owner_artist_id: string
          primary_location_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          handle?: string
          id?: string
          is_published?: boolean
          name?: string
          owner_artist_id?: string
          primary_location_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shops_owner_artist_id_fkey"
            columns: ["owner_artist_id"]
            isOneToOne: true
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_primary_location_id_fkey"
            columns: ["primary_location_id"]
            isOneToOne: false
            referencedRelation: "studio_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      signed_waivers: {
        Row: {
          artist_id: string
          booking_id: string | null
          client_id: string | null
          content_snapshot: string
          created_at: string
          id: string
          ip_address: unknown
          retention_until: string | null
          session_id: string | null
          signature_data: string | null
          signature_type: string | null
          signed_at: string
          signed_document_url: string | null
          signer_dob: string | null
          signer_email: string | null
          signer_name: string
          state: Database["public"]["Enums"]["us_state"]
          template_id: string | null
          user_agent: string | null
        }
        Insert: {
          artist_id: string
          booking_id?: string | null
          client_id?: string | null
          content_snapshot: string
          created_at?: string
          id?: string
          ip_address?: unknown
          retention_until?: string | null
          session_id?: string | null
          signature_data?: string | null
          signature_type?: string | null
          signed_at?: string
          signed_document_url?: string | null
          signer_dob?: string | null
          signer_email?: string | null
          signer_name: string
          state: Database["public"]["Enums"]["us_state"]
          template_id?: string | null
          user_agent?: string | null
        }
        Update: {
          artist_id?: string
          booking_id?: string | null
          client_id?: string | null
          content_snapshot?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          retention_until?: string | null
          session_id?: string | null
          signature_data?: string | null
          signature_type?: string | null
          signed_at?: string
          signed_document_url?: string | null
          signer_dob?: string | null
          signer_email?: string | null
          signer_name?: string
          state?: Database["public"]["Enums"]["us_state"]
          template_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signed_waivers_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signed_waivers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signed_waivers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signed_waivers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signed_waivers_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "waiver_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          api_version: string | null
          id: string
          livemode: boolean | null
          payload: Json | null
          received_at: string
          type: string
        }
        Insert: {
          api_version?: string | null
          id: string
          livemode?: boolean | null
          payload?: Json | null
          received_at?: string
          type: string
        }
        Update: {
          api_version?: string | null
          id?: string
          livemode?: boolean | null
          payload?: Json | null
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      studio_locations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          artist_id: string
          city: string | null
          country: string
          created_at: string
          id: string
          is_primary: boolean
          is_public: boolean
          lat: number | null
          lng: number | null
          name: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: Database["public"]["Enums"]["us_state"] | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          artist_id: string
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          is_public?: boolean
          lat?: number | null
          lng?: number | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: Database["public"]["Enums"]["us_state"] | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          artist_id?: string
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          is_public?: boolean
          lat?: number | null
          lng?: number | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: Database["public"]["Enums"]["us_state"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_locations_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      styles: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      threads: {
        Row: {
          artist_id: string
          booking_id: string | null
          booking_request_id: string | null
          client_id: string
          created_at: string
          id: string
          last_message_at: string | null
          status: Database["public"]["Enums"]["thread_status"]
          subject: string | null
          updated_at: string
        }
        Insert: {
          artist_id: string
          booking_id?: string | null
          booking_request_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: Database["public"]["Enums"]["thread_status"]
          subject?: string | null
          updated_at?: string
        }
        Update: {
          artist_id?: string
          booking_id?: string | null
          booking_request_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: Database["public"]["Enums"]["thread_status"]
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_booking_request_id_fkey"
            columns: ["booking_request_id"]
            isOneToOne: false
            referencedRelation: "booking_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          artist_id: string
          client_id: string
          created_at: string
          earliest_date: string | null
          id: string
          latest_date: string | null
          note: string | null
          preferred_time_end: string | null
          preferred_time_start: string | null
          preferred_weekdays: number[] | null
          priority: number
          service_id: string | null
          status: Database["public"]["Enums"]["waitlist_entry_status"]
          updated_at: string
        }
        Insert: {
          artist_id: string
          client_id: string
          created_at?: string
          earliest_date?: string | null
          id?: string
          latest_date?: string | null
          note?: string | null
          preferred_time_end?: string | null
          preferred_time_start?: string | null
          preferred_weekdays?: number[] | null
          priority?: number
          service_id?: string | null
          status?: Database["public"]["Enums"]["waitlist_entry_status"]
          updated_at?: string
        }
        Update: {
          artist_id?: string
          client_id?: string
          created_at?: string
          earliest_date?: string | null
          id?: string
          latest_date?: string | null
          note?: string | null
          preferred_time_end?: string | null
          preferred_time_start?: string | null
          preferred_weekdays?: number[] | null
          priority?: number
          service_id?: string | null
          status?: Database["public"]["Enums"]["waitlist_entry_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_offers: {
        Row: {
          artist_id: string
          booking_id: string | null
          client_id: string
          created_at: string
          expires_at: string
          id: string
          offered_at: string
          opening_id: string
          responded_at: string | null
          service_id: string | null
          session_id: string | null
          slot_end: string | null
          slot_start: string
          status: Database["public"]["Enums"]["waitlist_offer_status"]
          updated_at: string
          waitlist_entry_id: string
        }
        Insert: {
          artist_id: string
          booking_id?: string | null
          client_id: string
          created_at?: string
          expires_at: string
          id?: string
          offered_at?: string
          opening_id: string
          responded_at?: string | null
          service_id?: string | null
          session_id?: string | null
          slot_end?: string | null
          slot_start: string
          status?: Database["public"]["Enums"]["waitlist_offer_status"]
          updated_at?: string
          waitlist_entry_id: string
        }
        Update: {
          artist_id?: string
          booking_id?: string | null
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          offered_at?: string
          opening_id?: string
          responded_at?: string | null
          service_id?: string | null
          session_id?: string | null
          slot_end?: string | null
          slot_start?: string
          status?: Database["public"]["Enums"]["waitlist_offer_status"]
          updated_at?: string
          waitlist_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_offers_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_offers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_offers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_offers_opening_id_fkey"
            columns: ["opening_id"]
            isOneToOne: false
            referencedRelation: "waitlist_openings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_offers_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_offers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_offers_waitlist_entry_id_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "waitlist_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_openings: {
        Row: {
          artist_id: string
          created_at: string
          id: string
          service_id: string | null
          session_id: string | null
          slot_end: string | null
          slot_start: string
          source: string
          status: Database["public"]["Enums"]["waitlist_opening_status"]
          updated_at: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          id?: string
          service_id?: string | null
          session_id?: string | null
          slot_end?: string | null
          slot_start: string
          source?: string
          status?: Database["public"]["Enums"]["waitlist_opening_status"]
          updated_at?: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          id?: string
          service_id?: string | null
          session_id?: string | null
          slot_end?: string | null
          slot_start?: string
          source?: string
          status?: Database["public"]["Enums"]["waitlist_opening_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_openings_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_openings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_openings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      waiver_templates: {
        Row: {
          artist_id: string | null
          body: string
          created_at: string
          id: string
          is_active: boolean
          required_fields: Json
          state: Database["public"]["Enums"]["us_state"] | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          artist_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_active?: boolean
          required_fields?: Json
          state?: Database["public"]["Enums"]["us_state"] | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          artist_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          required_fields?: Json
          state?: Database["public"]["Enums"]["us_state"] | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "waiver_templates_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      agent_jobs_lease: {
        Args: { p_limit?: number }
        Returns: {
          artist_id: string
          attempts: number
          booking_request_id: string | null
          created_at: string
          dedupe_key: string
          id: string
          job_kind: string | null
          last_error: string | null
          leased_at: string | null
          max_attempts: number
          scheduled_at: string
          status: string
          thread_id: string | null
          trigger_id: string
          trigger_kind: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "agent_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      agent_run_tick: { Args: never; Returns: undefined }
      agent_scheduled_enqueue: { Args: never; Returns: undefined }
      agent_scheduled_tick: { Args: never; Returns: undefined }
      claim_waitlist_offer: { Args: { p_offer_id: string }; Returns: string }
      current_artist_id: { Args: never; Returns: string }
      current_owned_shop_id: { Args: never; Returns: string }
      daily_drop_tick: { Args: never; Returns: undefined }
      decline_waitlist_offer: {
        Args: { p_offer_id: string }
        Returns: undefined
      }
      enqueue_untagged_images: { Args: never; Returns: number }
      feed_filter_artist_ids: {
        Args: {
          p_books_open?: boolean
          p_lat?: number
          p_lng?: number
          p_price_max?: number
          p_price_min?: number
          p_radius_km?: number
          p_state?: string
        }
        Returns: string[]
      }
      image_tag_jobs_lease: {
        Args: { p_limit?: number }
        Returns: {
          artist_id: string | null
          attempts: number
          created_at: string
          dedupe_key: string
          id: string
          image_url: string | null
          last_error: string | null
          leased_at: string | null
          max_attempts: number
          scheduled_at: string
          status: string
          subject_id: string
          subject_type: Database["public"]["Enums"]["image_subject_type"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "image_tag_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      image_tag_run_tick: { Args: never; Returns: undefined }
      is_shop_manager: { Args: { p_shop_id: string }; Returns: boolean }
      notification_category_default_email: {
        Args: { p_category: string }
        Returns: boolean
      }
      notification_category_for_type: {
        Args: { p_type: string }
        Returns: string
      }
      notification_deliveries_lease: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          channel: string
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          notification_id: string
          provider_ref: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_deliveries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      notify_dispatch_tick: { Args: never; Returns: undefined }
      register_push_token: {
        Args: { p_platform: string; p_token: string }
        Returns: string
      }
      search_artists: {
        Args: {
          p_books_open?: boolean
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_offset?: number
          p_price_max?: number
          p_price_min?: number
          p_query?: string
          p_radius_km?: number
          p_state?: string
          p_style_slugs?: string[]
        }
        Returns: {
          artist_id: string
          avatar_url: string
          books_open: boolean
          city: string
          classification: Database["public"]["Enums"]["artist_classification"]
          display_name: string
          distance_km: number
          handle: string
          has_active_flash: boolean
          lat: number
          lng: number
          min_price_cents: number
          state: string
          styles: string[]
          travel_at_home: boolean
          travel_fly_out: boolean
          travel_house_calls: boolean
        }[]
      }
      search_shops: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_state?: string
        }
        Returns: {
          avatar_url: string
          bio: string
          city: string
          handle: string
          member_count: number
          name: string
          shop_id: string
          state: string
        }[]
      }
      shop_managed_member_agenda: {
        Args: { p_from?: string; p_limit?: number; p_shop_id: string }
        Returns: {
          booking_id: string
          member_artist_id: string
          member_handle: string
          member_name: string
          scheduled_end: string
          scheduled_start: string
          session_id: string
          session_number: number
          session_status: Database["public"]["Enums"]["session_status"]
        }[]
      }
      similar_works: {
        Args: {
          p_embedding: string
          p_exclude_artist?: string
          p_limit?: number
          p_style_slugs?: string[]
        }
        Returns: {
          artist_id: string
          color_type: Database["public"]["Enums"]["image_color_type"]
          image_url: string
          similarity: number
          styles: string[]
          subject_id: string
          subject_type: Database["public"]["Enums"]["image_subject_type"]
        }[]
      }
      user_style_affinity: {
        Args: { p_user_id: string }
        Returns: {
          style_slug: string
          top_source: string
          weight: number
        }[]
      }
      waitlist_artist_open_session: {
        Args: { p_session_id: string }
        Returns: string
      }
      waitlist_cascade: { Args: { p_opening_id: string }; Returns: undefined }
      waitlist_create_offer: {
        Args: { p_entry_id: string; p_opening_id: string }
        Returns: string
      }
      waitlist_match_next: { Args: { p_opening_id: string }; Returns: string }
      waitlist_open_slot: {
        Args: {
          p_artist_id: string
          p_service_id: string
          p_session_id: string
          p_slot_end: string
          p_slot_start: string
          p_source: string
        }
        Returns: string
      }
      waitlist_tick: { Args: never; Returns: undefined }
    }
    Enums: {
      aftercare_checkin_kind: "day_3" | "week_1" | "week_3"
      aftercare_checkin_status: "pending" | "sent" | "responded" | "skipped"
      agent_action_status:
        | "proposed"
        | "approved"
        | "executed"
        | "rejected"
        | "failed"
        | "superseded"
      agent_autonomy: "no_ai" | "draft_only" | "assisted" | "managed"
      agent_role:
        | "front_desk"
        | "booking_manager"
        | "studio_manager"
        | "growth_advisor"
      artist_classification:
        | "shop_owner"
        | "shop_resident"
        | "private_suite"
        | "independent"
      availability_block_type:
        | "vacation"
        | "holiday"
        | "personal"
        | "sick"
        | "custom"
      booking_request_status:
        | "pending"
        | "reviewing"
        | "accepted"
        | "declined"
        | "converted"
        | "withdrawn"
        | "expired"
      booking_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      booking_window: "1mo" | "2_3mo" | "4_6mo" | "1yr" | "closed"
      deposit_type: "none" | "fixed" | "percent"
      image_color_type: "color" | "black_grey" | "both" | "unknown"
      image_size_estimate: "small" | "medium" | "large" | "unknown"
      image_subject_type: "portfolio_piece" | "post" | "flash_item"
      payment_kind: "deposit" | "balance" | "refund" | "adjustment" | "payout"
      payment_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "refunded"
        | "partially_refunded"
        | "canceled"
      playbook_category:
        | "faq"
        | "tone"
        | "policy"
        | "pricing"
        | "aftercare"
        | "scheduling"
        | "other"
      playbook_source: "onboarding" | "manual" | "agent_suggested"
      post_source: "inkd" | "instagram" | "manual_upload"
      sender_kind: "client" | "artist" | "agent"
      service_price_type: "fixed" | "hourly" | "starting_at" | "quote"
      session_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
        | "rescheduled"
      shop_member_role: "owner" | "manager" | "resident" | "guest"
      shop_member_status: "invited" | "active" | "removed"
      shop_membership_mode: "promotional" | "managed"
      thread_status: "active" | "archived" | "closed"
      us_state: "MD" | "PA"
      waitlist_entry_status:
        | "active"
        | "offered"
        | "claimed"
        | "expired"
        | "cancelled"
      waitlist_offer_status: "pending" | "accepted" | "declined" | "expired"
      waitlist_opening_status:
        | "open"
        | "filled"
        | "exhausted"
        | "expired"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      aftercare_checkin_kind: ["day_3", "week_1", "week_3"],
      aftercare_checkin_status: ["pending", "sent", "responded", "skipped"],
      agent_action_status: [
        "proposed",
        "approved",
        "executed",
        "rejected",
        "failed",
        "superseded",
      ],
      agent_autonomy: ["no_ai", "draft_only", "assisted", "managed"],
      agent_role: [
        "front_desk",
        "booking_manager",
        "studio_manager",
        "growth_advisor",
      ],
      artist_classification: [
        "shop_owner",
        "shop_resident",
        "private_suite",
        "independent",
      ],
      availability_block_type: [
        "vacation",
        "holiday",
        "personal",
        "sick",
        "custom",
      ],
      booking_request_status: [
        "pending",
        "reviewing",
        "accepted",
        "declined",
        "converted",
        "withdrawn",
        "expired",
      ],
      booking_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      booking_window: ["1mo", "2_3mo", "4_6mo", "1yr", "closed"],
      deposit_type: ["none", "fixed", "percent"],
      image_color_type: ["color", "black_grey", "both", "unknown"],
      image_size_estimate: ["small", "medium", "large", "unknown"],
      image_subject_type: ["portfolio_piece", "post", "flash_item"],
      payment_kind: ["deposit", "balance", "refund", "adjustment", "payout"],
      payment_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "refunded",
        "partially_refunded",
        "canceled",
      ],
      playbook_category: [
        "faq",
        "tone",
        "policy",
        "pricing",
        "aftercare",
        "scheduling",
        "other",
      ],
      playbook_source: ["onboarding", "manual", "agent_suggested"],
      post_source: ["inkd", "instagram", "manual_upload"],
      sender_kind: ["client", "artist", "agent"],
      service_price_type: ["fixed", "hourly", "starting_at", "quote"],
      session_status: [
        "scheduled",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
        "rescheduled",
      ],
      shop_member_role: ["owner", "manager", "resident", "guest"],
      shop_member_status: ["invited", "active", "removed"],
      shop_membership_mode: ["promotional", "managed"],
      thread_status: ["active", "archived", "closed"],
      us_state: ["MD", "PA"],
      waitlist_entry_status: [
        "active",
        "offered",
        "claimed",
        "expired",
        "cancelled",
      ],
      waitlist_offer_status: ["pending", "accepted", "declined", "expired"],
      waitlist_opening_status: [
        "open",
        "filled",
        "exhausted",
        "expired",
        "cancelled",
      ],
    },
  },
} as const
