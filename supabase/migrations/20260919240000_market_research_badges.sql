-- OTA 마케팅 뱃지 카탈로그 (Likely to sell out, Top Pick 등)
begin;

create table if not exists public.market_research_badges (
  operator_id uuid not null default 'a0000000-0000-4000-8000-000000000001'::uuid
    references public.operators(id) on delete cascade,
  badge_id text not null,
  label_ko text not null,
  label_en text not null,
  sort_order integer not null default 0,
  is_preset boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (operator_id, badge_id)
);

create index if not exists idx_market_research_badges_operator
  on public.market_research_badges (operator_id, sort_order, badge_id);

comment on table public.market_research_badges is
  'OTA marketing badges staff can attach to a competitor listing observation (e.g. Likely to sell out).';

alter table public.market_research_badges enable row level security;

revoke all on table public.market_research_badges from anon;
grant select, insert, update, delete on table public.market_research_badges to authenticated;
grant all on table public.market_research_badges to service_role;

drop policy if exists market_research_badges_staff_select on public.market_research_badges;
create policy market_research_badges_staff_select
  on public.market_research_badges for select to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_research_badges_staff_insert on public.market_research_badges;
create policy market_research_badges_staff_insert
  on public.market_research_badges for insert to authenticated
  with check (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_research_badges_staff_update on public.market_research_badges;
create policy market_research_badges_staff_update
  on public.market_research_badges for update to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok())
  with check (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_research_badges_staff_delete on public.market_research_badges;
create policy market_research_badges_staff_delete
  on public.market_research_badges for delete to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

insert into public.market_research_badges (badge_id, label_ko, label_en, sort_order, is_preset)
values
  ('likely_to_sell_out', 'Likely to sell out', 'Likely to sell out', 0, true),
  ('top_pick', 'Top Pick', 'Top Pick', 1, true),
  ('bestseller', 'Bestseller', 'Bestseller', 2, true),
  ('travelers_choice', 'Travelers'' Choice', 'Travelers'' Choice', 3, true),
  ('special_offer', 'Special offer', 'Special offer', 4, true),
  ('great_value', 'Great value', 'Great value', 5, true),
  ('popular', 'Popular', 'Popular', 6, true),
  ('limited_availability', 'Limited availability', 'Limited availability', 7, true)
on conflict (operator_id, badge_id) do nothing;

commit;
