-- Migration: enums
-- All enumerated types for INKD schema v1.

create type public.artist_classification as enum (
  'shop_owner', 'shop_resident', 'private_suite', 'independent'
);

create type public.booking_window as enum (
  '1mo', '2_3mo', '4_6mo', '1yr', 'closed'
);

create type public.service_price_type as enum (
  'fixed', 'hourly', 'starting_at', 'quote'
);

create type public.deposit_type as enum (
  'none', 'fixed', 'percent'
);

create type public.booking_request_status as enum (
  'pending', 'reviewing', 'accepted', 'declined', 'converted', 'withdrawn', 'expired'
);

create type public.booking_status as enum (
  'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'
);

create type public.session_status as enum (
  'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled'
);

create type public.payment_kind as enum (
  'deposit', 'balance', 'refund', 'adjustment', 'payout'
);

create type public.payment_status as enum (
  'pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'canceled'
);

create type public.us_state as enum (
  'MD', 'PA'
);

create type public.availability_block_type as enum (
  'vacation', 'holiday', 'personal', 'sick', 'custom'
);

create type public.sender_kind as enum (
  'client', 'artist', 'agent'
);

create type public.thread_status as enum (
  'active', 'archived', 'closed'
);

create type public.post_source as enum (
  'inkd', 'instagram', 'manual_upload'
);

create type public.agent_autonomy as enum (
  'no_ai', 'draft_only', 'assisted', 'managed'
);

create type public.agent_role as enum (
  'front_desk', 'booking_manager', 'studio_manager', 'growth_advisor'
);

create type public.agent_action_status as enum (
  'proposed', 'approved', 'executed', 'rejected', 'failed', 'superseded'
);

create type public.playbook_category as enum (
  'faq', 'tone', 'policy', 'pricing', 'aftercare', 'scheduling', 'other'
);

create type public.playbook_source as enum (
  'onboarding', 'manual', 'agent_suggested'
);
