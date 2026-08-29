-- Tour report Driving segments catalog + selected ids on tour_reports.
-- Write: OP / office manager / super (customer_insert_team_role_ok).
-- Read: authenticated staff so guides can select segments.

begin;

create table if not exists public.tour_report_driving_segments (
  id uuid primary key default gen_random_uuid(),
  label_ko text not null,
  label_en text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tour_report_driving_segments is
  '투어 리포트 Driving 구간 선택지. OP / office manager / super가 관리.';

alter table public.tour_reports
  add column if not exists driving_segment_ids text[] not null default '{}';

comment on column public.tour_reports.driving_segment_ids is
  '가이드가 운전한 tour_report_driving_segments.id 목록';

insert into public.tour_report_driving_segments (label_ko, label_en, sort_order) values
  ('호텔 픽업', 'Hotel Pickup', 10),
  ('라스베이거스 → 스타게이징', 'Las Vegas -> Stargazing', 20),
  ('스타게이징 → 킹먼', 'Stargazing -> Kingman', 30),
  ('킹먼 → 윌리엄스', 'Kingman -> Williams', 40),
  ('윌리엄스 → 그랜드캐년 사우스', 'Williams -> Grand Canyon South', 50),
  ('사우스림 → 이스트림', 'South Rim -> East Rim', 60),
  ('이스트림 → 캐머런', 'East Rim -> Cameron', 70),
  ('캐머런 → 페이지', 'Cameron -> Page', 80),
  ('페이지 → 카납', 'Page -> Kanab', 90),
  ('카납 → 허리케인', 'Kanab -> Hurricane', 100),
  ('허리케인 → 라스베이거스', 'Hurricane -> Las Vegas', 110),
  ('호텔 드롭', 'Hotel Drop', 120);

alter table public.tour_report_driving_segments enable row level security;

grant select, insert, update, delete on table public.tour_report_driving_segments to authenticated;

drop policy if exists "tour_report_driving_segments_select" on public.tour_report_driving_segments;
create policy "tour_report_driving_segments_select"
  on public.tour_report_driving_segments
  for select
  to authenticated
  using (
    public.is_staff()
    or public.is_staff_for_session()
    or public.customer_insert_team_role_ok()
  );

drop policy if exists "tour_report_driving_segments_insert" on public.tour_report_driving_segments;
create policy "tour_report_driving_segments_insert"
  on public.tour_report_driving_segments
  for insert
  to authenticated
  with check (public.customer_insert_team_role_ok());

drop policy if exists "tour_report_driving_segments_update" on public.tour_report_driving_segments;
create policy "tour_report_driving_segments_update"
  on public.tour_report_driving_segments
  for update
  to authenticated
  using (public.customer_insert_team_role_ok())
  with check (public.customer_insert_team_role_ok());

drop policy if exists "tour_report_driving_segments_delete" on public.tour_report_driving_segments;
create policy "tour_report_driving_segments_delete"
  on public.tour_report_driving_segments
  for delete
  to authenticated
  using (public.customer_insert_team_role_ok());

commit;
