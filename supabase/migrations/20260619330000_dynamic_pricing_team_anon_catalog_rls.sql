-- Step 19 (RLS hardening): dynamic_pricing — 공개 예약(anon)·팀(ReservationForm 등) SELECT, 쓰기는 스태프
-- products의 anon 전역 읽기 축소는 예약/영수증/대시보드 등 비활성 상품 조회와 충돌하므로 별도 설계 후 진행.
-- Depends: public.is_staff(text), public.is_team_member(text), public.current_email().

begin;

-- ---------- dynamic_pricing ----------
alter table public.dynamic_pricing enable row level security;

drop policy if exists "Allow public access" on public.dynamic_pricing;
drop policy if exists "dynamic_pricing_select_staff" on public.dynamic_pricing;
drop policy if exists "dynamic_pricing_insert_staff" on public.dynamic_pricing;
drop policy if exists "dynamic_pricing_update_staff" on public.dynamic_pricing;
drop policy if exists "dynamic_pricing_delete_staff" on public.dynamic_pricing;

revoke all on table public.dynamic_pricing from anon;
grant select on table public.dynamic_pricing to anon;

grant select, insert, update, delete on table public.dynamic_pricing to authenticated;

create policy "dynamic_pricing_select_anon_catalog"
  on public.dynamic_pricing for select to anon
  using (
    product_id is not null
    and exists (
      select 1
      from public.products p
      where p.id = dynamic_pricing.product_id
        and lower(trim(coalesce(p.status::text, ''))) = 'active'
    )
    and coalesce(dynamic_pricing.is_sale_available, true)
  );

create policy "dynamic_pricing_select_team"
  on public.dynamic_pricing for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
  );

create policy "dynamic_pricing_insert_staff"
  on public.dynamic_pricing for insert to authenticated
  with check (public.is_staff(public.current_email()));

create policy "dynamic_pricing_update_staff"
  on public.dynamic_pricing for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

create policy "dynamic_pricing_delete_staff"
  on public.dynamic_pricing for delete to authenticated
  using (public.is_staff(public.current_email()));

commit;
