-- 자사 상품 × OTA 포함/불포함 마스터 (판매가는 기존 동적가격을 읽음)
begin;

create table if not exists public.market_research_our_offers (
  operator_id uuid not null default 'a0000000-0000-4000-8000-000000000001'::uuid
    references public.operators(id) on delete cascade,
  product_id text not null,
  ota_platform text not null,
  inclusion_items jsonb not null default '{}'::jsonb,
  excluded_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (operator_id, product_id, ota_platform)
);

create index if not exists idx_market_research_our_offers_operator
  on public.market_research_our_offers (operator_id, product_id, ota_platform);

comment on table public.market_research_our_offers is
  'Kovegas include/exclude rows per product and OTA for the market-research pricing board.';

alter table public.market_research_our_offers enable row level security;

revoke all on table public.market_research_our_offers from anon;
grant select, insert, update, delete on table public.market_research_our_offers to authenticated;
grant all on table public.market_research_our_offers to service_role;

drop policy if exists market_research_our_offers_staff_select on public.market_research_our_offers;
create policy market_research_our_offers_staff_select
  on public.market_research_our_offers for select to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_research_our_offers_staff_insert on public.market_research_our_offers;
create policy market_research_our_offers_staff_insert
  on public.market_research_our_offers for insert to authenticated
  with check (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_research_our_offers_staff_update on public.market_research_our_offers;
create policy market_research_our_offers_staff_update
  on public.market_research_our_offers for update to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok())
  with check (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_research_our_offers_staff_delete on public.market_research_our_offers;
create policy market_research_our_offers_staff_delete
  on public.market_research_our_offers for delete to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

commit;
