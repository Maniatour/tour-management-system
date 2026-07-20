-- Expand detail_content_library kinds to cover all 운영 안내 fields
-- (pickup, luggage, preparation, small group, companion, notice).

begin;

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
    'important_notes',
    'cancellation_policy',
    'private_tour_info',
    'chat_announcement'
  ));

comment on table public.detail_content_library is
  'Reusable product detail snippets: 운영 안내 + 정책 fields';

commit;
