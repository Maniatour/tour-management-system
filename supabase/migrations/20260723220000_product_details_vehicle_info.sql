-- Vehicle info field for product details + reusable library kind

begin;

alter table public.product_details_multilingual
  add column if not exists vehicle_info text;

comment on column public.product_details_multilingual.vehicle_info is
  'Vehicle / transportation information for the tour';

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_details'
  ) then
    alter table public.product_details
      add column if not exists vehicle_info text;
  end if;
end $$;

alter table public.detail_content_library
  drop constraint if exists detail_content_library_kind_check;

alter table public.detail_content_library
  add constraint detail_content_library_kind_check
  check (kind in (
    'pickup_drop_info',
    'luggage_info',
    'tour_operation_info',
    'preparation_info',
    'small_group_info',
    'companion_recruitment_info',
    'notice_info',
    'vehicle_info',
    'important_notes',
    'cancellation_policy',
    'private_tour_info',
    'chat_announcement'
  ));

alter table public.product_detail_content_links
  drop constraint if exists product_detail_content_links_kind_check;

alter table public.product_detail_content_links
  add constraint product_detail_content_links_kind_check
  check (kind in (
    'pickup_drop_info',
    'luggage_info',
    'tour_operation_info',
    'preparation_info',
    'small_group_info',
    'companion_recruitment_info',
    'notice_info',
    'vehicle_info',
    'important_notes',
    'cancellation_policy',
    'private_tour_info',
    'chat_announcement'
  ));

commit;
