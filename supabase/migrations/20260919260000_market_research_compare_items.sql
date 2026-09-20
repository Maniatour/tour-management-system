-- 가격 비교 불포함 사항 마스터 항목 (그랜드캐년, 가이드 팁 등)
begin;

create table if not exists public.market_research_compare_items (
  operator_id uuid not null default 'a0000000-0000-4000-8000-000000000001'::uuid
    references public.operators(id) on delete cascade,
  item_id text not null,
  label_ko text not null,
  label_en text not null,
  sort_order integer not null default 0,
  is_preset boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (operator_id, item_id)
);

create index if not exists idx_market_research_compare_items_operator
  on public.market_research_compare_items (operator_id, sort_order, item_id);

comment on table public.market_research_compare_items is
  'Master catalog of include/exclude rows shown on the market-research pricing board.';

alter table public.market_research_compare_items enable row level security;

revoke all on table public.market_research_compare_items from anon;
grant select, insert, update, delete on table public.market_research_compare_items to authenticated;
grant all on table public.market_research_compare_items to service_role;

drop policy if exists market_research_compare_items_staff_select on public.market_research_compare_items;
create policy market_research_compare_items_staff_select
  on public.market_research_compare_items for select to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_research_compare_items_staff_insert on public.market_research_compare_items;
create policy market_research_compare_items_staff_insert
  on public.market_research_compare_items for insert to authenticated
  with check (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_research_compare_items_staff_update on public.market_research_compare_items;
create policy market_research_compare_items_staff_update
  on public.market_research_compare_items for update to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok())
  with check (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_research_compare_items_staff_delete on public.market_research_compare_items;
create policy market_research_compare_items_staff_delete
  on public.market_research_compare_items for delete to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

insert into public.market_research_compare_items (item_id, label_ko, label_en, sort_order, is_preset)
values
  ('grand_canyon', '그랜드캐년', 'Grand Canyon', 0, true),
  ('antelope_canyon', '앤텔롭 캐년', 'Antelope Canyon', 1, true),
  ('horseshoe_bend', '홀스슈 밴드', 'Horseshoe Bend', 2, true),
  ('guide_tip', '가이드 팁', 'Guide tip', 3, true),
  ('breakfast', '아침 식사', 'Breakfast', 4, true),
  ('lunch', '점심 식사', 'Lunch', 5, true),
  ('dinner', '저녁 식사', 'Dinner', 6, true)
on conflict (operator_id, item_id) do nothing;

commit;
