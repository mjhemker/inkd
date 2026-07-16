-- Migration: booking_placement_bodymap
-- Structured body-map placement for booking_requests.
-- Adds region/side/view columns alongside the existing free-text `placement`
-- (kept for the specifics note + back-compat). Populated by the visual
-- body-map picker in the client booking intake.
alter table public.booking_requests
  add column placement_region text,
  add column placement_side   text,
  add column placement_view   text;

alter table public.booking_requests
  add constraint booking_requests_placement_side_chk
    check (placement_side is null or placement_side in ('left', 'right')),
  add constraint booking_requests_placement_view_chk
    check (placement_view is null or placement_view in ('front', 'back'));

comment on column public.booking_requests.placement_region is
  'Structured body-map region key (e.g. forearm, chest, upperBack). The free-text `placement` column is kept for specifics/back-compat.';
comment on column public.booking_requests.placement_side is
  'Wearer-anatomical side for lateral regions: left | right | null.';
comment on column public.booking_requests.placement_view is
  'Body-map view the region was chosen on: front | back | null.';
