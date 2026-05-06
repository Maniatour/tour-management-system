-- Step 18 (RLS hardening): channel_products (팀·공개 카탈로그), product_options anon 범위 축소,
--   reservation_choices, product_faqs
-- Depends: public.is_staff(text), public.is_team_member(text), public.current_email(),
--   public.reservation_expense_row_accessible_as_assignee (20260619120000).

begin;

-- ---------- channel_products (19180000: 스태프만 SELECT → 팀 조회 + 공개 카탈로그 anon) ----------
drop policy if exists "channel_products_select_staff" on public.channel_products;

grant select on table public.channel_products to anon;

create policy "channel_products_select_anon_catalog"
  on public.channel_products for select to anon
  using (
    product_id is not null
    and exists (select 1 from public.products p where p.id = channel_products.product_id)
    and coalesce(channel_products.is_active, true)
  );

create policy "channel_products_select_team"
  on public.channel_products for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
  );

grant select, insert, update, delete on table public.channel_products to authenticated;

-- 기존 정책이 is_staff() 무인자를 쓰면 배포 DB에 래퍼가 없을 때 실패할 수 있어 current_email()과 맞춤
drop policy if exists "channel_products_insert_staff" on public.channel_products;
drop policy if exists "channel_products_update_staff" on public.channel_products;
drop policy if exists "channel_products_delete_staff" on public.channel_products;

create policy "channel_products_insert_staff"
  on public.channel_products for insert to authenticated
  with check (public.is_staff(public.current_email()));

create policy "channel_products_update_staff"
  on public.channel_products for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

create policy "channel_products_delete_staff"
  on public.channel_products for delete to authenticated
  using (public.is_staff(public.current_email()));

-- ---------- product_options (anon USING(true) → 상품에 연결된 행만) ----------
drop policy if exists "product_options_anon_select" on public.product_options;

create policy "product_options_anon_select"
  on public.product_options for select to anon
  using (
    product_id is not null
    and exists (select 1 from public.products p where p.id = product_options.product_id)
  );

-- ---------- reservation_choices ----------
alter table public.reservation_choices enable row level security;

revoke all on table public.reservation_choices from anon;
grant insert on table public.reservation_choices to anon;

grant select, insert, update, delete on table public.reservation_choices to authenticated;

-- 공개 예약 완료 시: 예약 행이 이미 있을 때만 삽입 (예약 RLS와 동일한 전제)
create policy "reservation_choices_insert_anon"
  on public.reservation_choices for insert to anon
  with check (
    reservation_id is not null
    and exists (select 1 from public.reservations r where r.id = reservation_choices.reservation_id)
  );

create policy "reservation_choices_select_access"
  on public.reservation_choices for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

create policy "reservation_choices_insert_access"
  on public.reservation_choices for insert to authenticated
  with check (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

create policy "reservation_choices_update_access"
  on public.reservation_choices for update to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  )
  with check (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

create policy "reservation_choices_delete_access"
  on public.reservation_choices for delete to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

-- ---------- product_faqs ----------
alter table public.product_faqs enable row level security;

drop policy if exists "Anyone can view product FAQs" on public.product_faqs;
drop policy if exists "Authenticated users can insert product FAQs" on public.product_faqs;
drop policy if exists "Authenticated users can update product FAQs" on public.product_faqs;
drop policy if exists "Authenticated users can delete product FAQs" on public.product_faqs;

revoke all on table public.product_faqs from anon;
grant select on table public.product_faqs to anon;

grant select, insert, update, delete on table public.product_faqs to authenticated;

create policy "product_faqs_select_anon"
  on public.product_faqs for select to anon
  using (
    exists (select 1 from public.products p where p.id = product_faqs.product_id)
    and coalesce(product_faqs.is_active, true)
  );

create policy "product_faqs_select_team"
  on public.product_faqs for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
  );

create policy "product_faqs_insert_staff"
  on public.product_faqs for insert to authenticated
  with check (public.is_staff(public.current_email()));

create policy "product_faqs_update_staff"
  on public.product_faqs for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

create policy "product_faqs_delete_staff"
  on public.product_faqs for delete to authenticated
  using (public.is_staff(public.current_email()));

commit;
