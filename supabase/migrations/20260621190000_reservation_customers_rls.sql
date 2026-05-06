-- reservation_customers: RLS 부재 보완 (예약-고객 다대다, PII 포함)
-- - anon: 활성 상품 예약에 한해 SELECT / INSERT / UPDATE / DELETE (공개 예약 플로우·거주 상태 동기)
-- - authenticated: SELECT = 소유·팀·가이드 등(reservation_row_visible) 또는 카탈로그 조회(인원 집계 등)
--   INSERT = 위 가시성 또는 카탈로그 예약
--   UPDATE/DELETE = reservation_row_visible 만 (카탈로그만 만족하는 타인 행 수정 차단 — reservations 와 동일)
-- Depends: reservation_row_visible_for_policy (20260621180000)

begin;

-- ---------- reservation_id_in_active_product_catalog (DEFINER: reservations RLS 우회) ----------
create or replace function public.reservation_id_in_active_product_catalog(p_reservation_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_reservation_id is not null
  and exists (
    select 1
    from public.reservations r
    where r.id = p_reservation_id
      and r.product_id is not null
      and exists (
        select 1
        from public.products p
        where p.id = r.product_id
          and lower(trim(coalesce(p.status::text, ''))) = 'active'
      )
  );
$$;

comment on function public.reservation_id_in_active_product_catalog(text) is
  'reservation_customers RLS: 예약이 활성 상품에 연결됐는지 (DEFINER, RLS 재귀 방지).';

-- ---------- reservation_customers ----------
alter table public.reservation_customers enable row level security;

drop policy if exists "reservation_customers_select_anon_catalog" on public.reservation_customers;
drop policy if exists "reservation_customers_select_authenticated" on public.reservation_customers;
drop policy if exists "reservation_customers_insert_accessible" on public.reservation_customers;
drop policy if exists "reservation_customers_update_anon_catalog" on public.reservation_customers;
drop policy if exists "reservation_customers_update_authenticated" on public.reservation_customers;
drop policy if exists "reservation_customers_delete_anon_catalog" on public.reservation_customers;
drop policy if exists "reservation_customers_delete_authenticated" on public.reservation_customers;

revoke all on table public.reservation_customers from anon;
grant select, insert, update, delete on table public.reservation_customers to anon;

grant select, insert, update, delete on table public.reservation_customers to authenticated;

create policy "reservation_customers_select_anon_catalog"
  on public.reservation_customers for select to anon
  using (public.reservation_id_in_active_product_catalog(reservation_id));

create policy "reservation_customers_select_authenticated"
  on public.reservation_customers for select to authenticated
  using (
    public.reservation_row_visible_for_policy(reservation_id)
    or public.reservation_id_in_active_product_catalog(reservation_id)
  );

create policy "reservation_customers_insert_accessible"
  on public.reservation_customers for insert to anon, authenticated
  with check (
    public.reservation_row_visible_for_policy(reservation_id)
    or public.reservation_id_in_active_product_catalog(reservation_id)
  );

create policy "reservation_customers_update_anon_catalog"
  on public.reservation_customers for update to anon
  using (public.reservation_id_in_active_product_catalog(reservation_id))
  with check (public.reservation_id_in_active_product_catalog(reservation_id));

create policy "reservation_customers_update_authenticated"
  on public.reservation_customers for update to authenticated
  using (public.reservation_row_visible_for_policy(reservation_id))
  with check (public.reservation_row_visible_for_policy(reservation_id));

create policy "reservation_customers_delete_anon_catalog"
  on public.reservation_customers for delete to anon
  using (public.reservation_id_in_active_product_catalog(reservation_id));

create policy "reservation_customers_delete_authenticated"
  on public.reservation_customers for delete to authenticated
  using (public.reservation_row_visible_for_policy(reservation_id));

commit;
