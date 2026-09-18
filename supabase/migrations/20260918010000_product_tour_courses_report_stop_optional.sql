-- Optional (선택) viewpoints: visit one, the other, or both (e.g. Lower vs Antelope X).

alter table public.product_tour_courses
  drop constraint if exists product_tour_courses_report_stop_role_check;

alter table public.product_tour_courses
  add constraint product_tour_courses_report_stop_role_check
  check (report_stop_role is null or report_stop_role in ('required', 'alternate', 'optional'));

comment on column public.product_tour_courses.report_stop_role is
  'Tour report: required, alternate substitute (counts toward required total), or optional (visit any combination). Null = itinerary only.';
