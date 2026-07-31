-- 투어 호텔 부킹용 호텔명·도시·웹사이트 참조 테이블
begin;

create table if not exists public.tour_hotel_references (
  id uuid primary key default gen_random_uuid(),
  hotel_name text not null,
  city text not null,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tour_hotel_references_hotel_name_unique unique (hotel_name)
);

create index if not exists tour_hotel_references_city_idx
  on public.tour_hotel_references (city);

comment on table public.tour_hotel_references is
  '투어 호텔 부킹 폼에서 호텔명 선택 시 도시·웹사이트 자동완성용 참조 데이터.';

alter table public.tour_hotel_references enable row level security;

revoke all on table public.tour_hotel_references from anon;
grant select, insert, update, delete on table public.tour_hotel_references to authenticated;

create policy "tour_hotel_references_select_staff"
  on public.tour_hotel_references for select to authenticated
  using (public.rls_is_staff_session_ok());

create policy "tour_hotel_references_insert_staff"
  on public.tour_hotel_references for insert to authenticated
  with check (public.rls_is_staff_session_ok());

create policy "tour_hotel_references_update_staff"
  on public.tour_hotel_references for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

create policy "tour_hotel_references_delete_staff"
  on public.tour_hotel_references for delete to authenticated
  using (public.rls_is_staff_session_ok());

commit;
