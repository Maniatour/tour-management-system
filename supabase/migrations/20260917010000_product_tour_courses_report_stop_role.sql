-- Tour report required/alternate viewpoints, plus 정차 category for pickup/drop.

alter table public.product_tour_courses
  add column if not exists report_stop_role text;

alter table public.product_tour_courses
  drop constraint if exists product_tour_courses_report_stop_role_check;

alter table public.product_tour_courses
  add constraint product_tour_courses_report_stop_role_check
  check (report_stop_role is null or report_stop_role in ('required', 'alternate'));

comment on column public.product_tour_courses.report_stop_role is
  'Tour report: required viewpoint or alternate substitute. Null = itinerary only.';

insert into public.tour_course_categories (
  name_ko,
  name_en,
  description_ko,
  description_en,
  color,
  icon,
  sort_order,
  is_active
)
select
  '정차',
  'Operational Stop',
  '호텔 픽업·드롭 등 관광지가 아닌 정차',
  'Operational stops such as hotel pickup and drop-off',
  '#64748B',
  'map-pin',
  8,
  true
where not exists (
  select 1
  from public.tour_course_categories
  where name_ko = '정차'
);

update public.tour_courses c
set
  category = '정차',
  category_id = cat.id
from public.tour_course_categories cat
where cat.name_ko = '정차'
  and (
    c.name_ko in ('호텔 픽업', '호텔 드롭', '호텔 드랍', '호텔픽업', '호텔드롭', '호텔드랍', '호텔 하차')
    or lower(regexp_replace(coalesce(c.name_en, ''), '[\s_-]+', ' ', 'g'))
      in ('hotel pickup', 'hotel pick up', 'hotel drop off', 'hotel dropoff')
    or lower(regexp_replace(coalesce(c.customer_name_ko, ''), '[\s_-]+', ' ', 'g'))
      in ('호텔 픽업', '호텔 드롭', '호텔 드랍', '호텔픽업', '호텔드롭')
    or lower(regexp_replace(coalesce(c.customer_name_en, ''), '[\s_-]+', ' ', 'g'))
      in ('hotel pickup', 'hotel pick up', 'hotel drop off', 'hotel dropoff')
  );
