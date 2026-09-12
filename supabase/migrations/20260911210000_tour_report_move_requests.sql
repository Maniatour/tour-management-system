-- Guide requests to move a tour report to a different tour.
-- Office staff review and approve; approval updates tour_reports.tour_id.
begin;

create table if not exists public.tour_report_move_requests (
  id text primary key default gen_random_uuid()::text,
  report_id text not null references public.tour_reports(id) on delete cascade,
  from_tour_id text not null references public.tours(id) on delete cascade,
  to_tour_id text not null references public.tours(id) on delete restrict,
  requested_by text not null,
  reason text,
  status text not null default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tour_report_move_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint tour_report_move_requests_different_tours
    check (from_tour_id <> to_tour_id)
);

create index if not exists idx_tour_report_move_requests_status_created
  on public.tour_report_move_requests (status, created_at desc);

create index if not exists idx_tour_report_move_requests_requested_by
  on public.tour_report_move_requests (lower(requested_by), created_at desc);

create index if not exists idx_tour_report_move_requests_report_id
  on public.tour_report_move_requests (report_id);

create unique index if not exists idx_tour_report_move_requests_one_pending
  on public.tour_report_move_requests (report_id)
  where status = 'pending';

comment on table public.tour_report_move_requests is
  'Guide requests to move a submitted tour report to a different tour. Office staff approve or reject.';

alter table public.tour_report_move_requests enable row level security;

revoke all on table public.tour_report_move_requests from anon;
grant select on table public.tour_report_move_requests to authenticated;

drop policy if exists "tour_report_move_requests_select_own_or_staff"
  on public.tour_report_move_requests;

create policy "tour_report_move_requests_select_own_or_staff"
  on public.tour_report_move_requests
  for select
  to authenticated
  using (
    lower(requested_by) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or public.rls_is_staff_session_ok()
  );

commit;
