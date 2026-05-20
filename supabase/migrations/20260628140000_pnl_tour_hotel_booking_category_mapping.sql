-- 통합 PNL: tour_hotel_bookings → COGS 투어 호텔 표준 리프(CAT024-002) 기본 매핑

begin;

insert into public.expense_category_mappings (
  original_value,
  source_table,
  standard_category_id,
  sub_category_id,
  match_count,
  last_matched_at
)
values (
  'Tour hotel booking',
  'tour_hotel_bookings',
  'CAT024',
  'CAT024-002',
  0,
  now()
)
on conflict (original_value, source_table) do update
set
  standard_category_id = excluded.standard_category_id,
  sub_category_id = excluded.sub_category_id,
  updated_at = now();

commit;
