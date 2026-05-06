-- Step 6 (RLS hardening): vehicles, suppliers, supplier_products, supplier_ticket_purchases
-- Replaces FOR ALL / USING(true) policies (20250101000107, 20250101000071).
-- team 활성 멤버는 public.is_staff() = true (가이드·운전 등 앱에서 차량 조회 유지).

begin;

-- ---------- vehicles ----------
alter table public.vehicles enable row level security;

drop policy if exists "Enable all access for vehicles" on public.vehicles;
drop policy if exists "Allow all users to read vehicles" on public.vehicles;
drop policy if exists "Allow all users to modify vehicles" on public.vehicles;

revoke all on table public.vehicles from anon;

create policy "vehicles_select_staff"
  on public.vehicles for select to authenticated
  using (public.is_staff());

create policy "vehicles_insert_staff"
  on public.vehicles for insert to authenticated
  with check (public.is_staff());

create policy "vehicles_update_staff"
  on public.vehicles for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "vehicles_delete_staff"
  on public.vehicles for delete to authenticated
  using (public.is_staff());

-- ---------- suppliers (한글 정책명) ----------
alter table public.suppliers enable row level security;

drop policy if exists "공급업체 조회 허용" on public.suppliers;
drop policy if exists "공급업체 수정 허용" on public.suppliers;

revoke all on table public.suppliers from anon;

create policy "suppliers_select_staff"
  on public.suppliers for select to authenticated
  using (public.is_staff());

create policy "suppliers_insert_staff"
  on public.suppliers for insert to authenticated
  with check (public.is_staff());

create policy "suppliers_update_staff"
  on public.suppliers for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "suppliers_delete_staff"
  on public.suppliers for delete to authenticated
  using (public.is_staff());

-- ---------- supplier_products ----------
alter table public.supplier_products enable row level security;

drop policy if exists "공급업체 상품 조회 허용" on public.supplier_products;
drop policy if exists "공급업체 상품 수정 허용" on public.supplier_products;

revoke all on table public.supplier_products from anon;

create policy "supplier_products_select_staff"
  on public.supplier_products for select to authenticated
  using (public.is_staff());

create policy "supplier_products_insert_staff"
  on public.supplier_products for insert to authenticated
  with check (public.is_staff());

create policy "supplier_products_update_staff"
  on public.supplier_products for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "supplier_products_delete_staff"
  on public.supplier_products for delete to authenticated
  using (public.is_staff());

-- ---------- supplier_ticket_purchases ----------
alter table public.supplier_ticket_purchases enable row level security;

drop policy if exists "공급업체 티켓 구매 조회 허용" on public.supplier_ticket_purchases;
drop policy if exists "공급업체 티켓 구매 수정 허용" on public.supplier_ticket_purchases;

revoke all on table public.supplier_ticket_purchases from anon;

create policy "supplier_ticket_purchases_select_staff"
  on public.supplier_ticket_purchases for select to authenticated
  using (public.is_staff());

create policy "supplier_ticket_purchases_insert_staff"
  on public.supplier_ticket_purchases for insert to authenticated
  with check (public.is_staff());

create policy "supplier_ticket_purchases_update_staff"
  on public.supplier_ticket_purchases for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "supplier_ticket_purchases_delete_staff"
  on public.supplier_ticket_purchases for delete to authenticated
  using (public.is_staff());

commit;
