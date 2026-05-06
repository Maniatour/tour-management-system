-- Step 20 (RLS hardening): products — anon/일반 인증은 active 위주, 팀·스태프는 전체 조회
-- 로그인 고객은 자신 이메일과 연결된 예약의 상품(비활성 포함) 조회 가능(대시보드 등).
-- 비로그인 영수증은 /api/public/receipt-row-meta (서비스 롤)로 보완.
-- Depends: public.is_staff(text), public.is_team_member(text), public.current_email().

begin;

alter table public.products enable row level security;

drop policy if exists "products_select_all" on public.products;
drop policy if exists "products_modify_staff_only" on public.products;
drop policy if exists "products_insert_staff" on public.products;
drop policy if exists "products_update_staff" on public.products;
drop policy if exists "products_delete_staff" on public.products;
drop policy if exists "products_select_anon_active" on public.products;
drop policy if exists "products_select_authenticated_active" on public.products;
drop policy if exists "products_select_by_customer_reservation" on public.products;
drop policy if exists "products_select_team_full" on public.products;

revoke all on table public.products from anon;
grant select on table public.products to anon;

grant select, insert, update, delete on table public.products to authenticated;

create policy "products_select_anon_active"
  on public.products for select to anon
  using (lower(trim(coalesce(status::text, ''))) = 'active');

create policy "products_select_authenticated_active"
  on public.products for select to authenticated
  using (lower(trim(coalesce(status::text, ''))) = 'active');

create policy "products_select_by_customer_reservation"
  on public.products for select to authenticated
  using (
    length(public.current_email()) > 0
    and exists (
      select 1
      from public.reservations r
      inner join public.customers c on c.id = r.customer_id
      where r.product_id = products.id
        and lower(trim(coalesce(c.email, ''))) = public.current_email()
    )
  );

create policy "products_select_team_full"
  on public.products for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
  );

create policy "products_insert_staff"
  on public.products for insert to authenticated
  with check (public.is_staff(public.current_email()));

create policy "products_update_staff"
  on public.products for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

create policy "products_delete_staff"
  on public.products for delete to authenticated
  using (public.is_staff(public.current_email()));

commit;
