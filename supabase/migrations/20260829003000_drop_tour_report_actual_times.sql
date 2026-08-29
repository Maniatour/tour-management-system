-- Remove unused actual departure/return times from tour reports.

alter table public.tour_reports
  drop column if exists actual_departure_time,
  drop column if exists actual_return_time;
