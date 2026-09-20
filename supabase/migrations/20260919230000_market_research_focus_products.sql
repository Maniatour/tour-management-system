-- 시장조사에서 비교할 자사 상품 탭 (밤도깨비 등)
begin;

create table if not exists public.market_research_focus_products (
  operator_id uuid not null default 'a0000000-0000-4000-8000-000000000001'::uuid
    references public.operators(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (operator_id, product_id)
);

create index if not exists idx_market_focus_products_operator
  on public.market_research_focus_products (operator_id, sort_order, product_id);

comment on table public.market_research_focus_products is
  'Which catalog products appear as comparison tabs on the market-research board.';

alter table public.market_research_focus_products enable row level security;

revoke all on table public.market_research_focus_products from anon;
grant select, insert, update, delete on table public.market_research_focus_products to authenticated;
grant all on table public.market_research_focus_products to service_role;

drop policy if exists market_focus_products_staff_select on public.market_research_focus_products;
create policy market_focus_products_staff_select
  on public.market_research_focus_products for select to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_focus_products_staff_insert on public.market_research_focus_products;
create policy market_focus_products_staff_insert
  on public.market_research_focus_products for insert to authenticated
  with check (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_focus_products_staff_delete on public.market_research_focus_products;
create policy market_focus_products_staff_delete
  on public.market_research_focus_products for delete to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

insert into public.market_research_focus_products (product_id, sort_order)
values ('MDGCSUNRISE', 0)
on conflict (operator_id, product_id) do nothing;

commit;
